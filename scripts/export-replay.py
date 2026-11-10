"""Convert the official ASVspoof2021 PA LFCC-LCNN checkpoint (not LA/DF).

Requires torch 2.6, numpy and onnx. Source and weights must be downloaded
to .local as described in public/models/REPLAY.md. No checkpoint code is run:
torch.load uses weights_only=True. Original BSD-licensed definitions are
loaded selectively for conversion and reference parity, not application use.
"""
import ast
import copy
import hashlib
import json
import pathlib
import sys
import types
import numpy as np
import torch

ROOT = pathlib.Path(__file__).resolve().parents[1]
checkpoint=ROOT/'.local/replay-weights/pa_trained_network.pt'
if hashlib.sha256(checkpoint.read_bytes()).hexdigest()!='1c6d6f30ed1042e584508a9adecc0e514983fff64cdfb3ae3de848064b6e91e0':
    raise ValueError('Checkpoint checksum mismatch: expected the verified official PA weights')
SOURCE = ROOT / '.local/asvspoof-source/2021-main'
BASE = SOURCE / 'LA/Baseline-LFCC-LCNN'
torch.set_num_threads(2)
# Compatibility for the original torch 1.6 frontend on torch 2.6.
torch.rfft = lambda x, n, onesided=True: torch.view_as_real(torch.fft.rfft(x) if onesided else torch.fft.fft(x))

def definitions(path, extra=None, names=None):
    namespace = dict(torch=torch, torch_nn=torch.nn, torch_nn_func=torch.nn.functional,
                     np=np, sys=sys, __name__='replay_reference')
    namespace.update(extra or {})
    tree = ast.parse(path.read_text(encoding='utf8'))
    tree.body = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.ClassDef))
                 and (names is None or node.name in names)]
    exec(compile(tree, str(path), 'exec'), namespace)
    return types.SimpleNamespace(**namespace)

blocks = definitions(BASE/'sandbox/block_nn.py', names={'BLSTMLayer','MaxFeatureMap2D'})
dsp = definitions(BASE/'sandbox/util_dsp.py')
frontend = definitions(BASE/'sandbox/util_frontend.py', {'nii_dsp':dsp,'nii_conf':types.SimpleNamespace(d_dtype=torch.float32)})
definition = definitions(SOURCE/'PA/Baseline-LFCC-LCNN/project/baseline_PA/model.py',
                         {'nii_nn':blocks,'nii_front_end':frontend})
model = definition.Model(1,1,None,types.SimpleNamespace(optional_argument=['missing-protocol-for-inference']))
state = torch.load(checkpoint, map_location='cpu', weights_only=True)
model.load_state_dict(state, strict=True)
model.eval()

class ExportMFM(torch.nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.half=channels//2
    def forward(self,x):
        return torch.maximum(x[:,:self.half],x[:,self.half:])

class FeatureNetwork(torch.nn.Module):
    def __init__(self, original):
        super().__init__()
        self.conv=copy.deepcopy(original.m_transform[0])
        channels=1
        for index, layer in enumerate(self.conv):
            if isinstance(layer,torch.nn.Conv2d): channels=layer.out_channels
            if isinstance(layer,blocks.MaxFeatureMap2D):
                self.conv[index]=ExportMFM(channels)
                channels//=2
        self.recurrent=original.m_before_pooling[0]
        self.output=original.m_output_act[0]
    def forward(self, lfcc):
        x=self.conv(lfcc.unsqueeze(1)).permute(0,2,1,3)
        x=x.reshape(x.shape[0],x.shape[1],96)
        return self.output((self.recurrent(x)+x).mean(1))

network=FeatureNetwork(model).eval()
destination=ROOT/'public/models'
destination.mkdir(exist_ok=True,parents=True)
torch.onnx.export(network,torch.zeros(1,201,60),destination/'replay.onnx',
                  input_names=['lfcc'],output_names=['bonafide_logit'],opset_version=17,
                  dynamic_axes={'lfcc':{1:'frames'}},dynamo=False)
parameters={
    'filterbank':state['m_frontend.0.lfcc_fb'].tolist(),
    'dct':state['m_frontend.0.l_dct.weight'].tolist(),
    'window':torch.hamming_window(320).tolist(),
}
(destination/'replay-frontend.json').write_text(json.dumps(parameters,separators=(',',':')))

# Use original STFT and LFCC, including its truncated spectrum energy, as reference.
original_stft=torch.stft
torch.stft=lambda *args,**kwargs: original_stft(*args,**kwargs,return_complex=False)
references=[]
with torch.no_grad():
    for n in [3200,32000,64000,128000]:
        t=np.arange(n,dtype=np.float64)
        waveform=(.08*np.sin(t*.137)+.03*np.cos(t*.071)+.01*np.sin(t*t*.001)).astype(np.float32)
        x=torch.from_numpy(waveform).unsqueeze(0)
        features=model.m_frontend[0](x)
        entry={'length':n,'frames':features.shape[1]}
        if n==3200: entry['features']=features.flatten().tolist()
        else:
            entry['logit']=network(features).item()
            # Check wrapper against original embedding path.
            original=model._compute_embedding(x.unsqueeze(-1),[n]).item()
            assert abs(original-entry['logit'])<1e-6
        references.append(entry)
fixture=ROOT/'tests/fixtures/replay-reference.json'
fixture.parent.mkdir(parents=True,exist_ok=True)
fixture.write_text(json.dumps(references,separators=(',',':')))
print('Exported PA replay network, exact frontend parameters and parity fixtures.')
