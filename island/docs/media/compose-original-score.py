import numpy as np,wave,json,subprocess
from pathlib import Path
import sys
out=Path(sys.argv[1] if len(sys.argv)>1 else '.').resolve();out.mkdir(parents=True,exist_ok=True);sr=44100;duration=30.;beat=60/96
mix=np.zeros((int(sr*(duration+2)),2),dtype=np.float64);rng=np.random.default_rng(107)
def add(sig,start,amp=.1,pan=0):
 p=int(start*sr);n=min(len(sig),len(mix)-p)
 if n<=0:return
 mix[p:p+n,0]+=sig[:n]*amp*np.sqrt((1-pan)/2)
 mix[p:p+n,1]+=sig[:n]*amp*np.sqrt((1+pan)/2)
def tone(midi,length,kind='keys',vel=1):
 t=np.arange(int(sr*length))/sr;f=440*2**((midi-69)/12)
 if kind=='keys':
  s=np.sin(2*np.pi*f*t)*np.exp(-t/1.3)
  s+=.24*np.sin(2*np.pi*f*2.004*t)*np.exp(-t/.45)
  s+=.08*np.sin(2*np.pi*f*3*t)*np.exp(-t/.18)
  s+=.04*np.sin(2*np.pi*f*.998*t)*np.exp(-t/1.6)
 elif kind=='bell':
  s=np.sin(2*np.pi*f*t)*np.exp(-t/.75)+.23*np.sin(2*np.pi*f*2.01*t)*np.exp(-t/.19)+.10*np.sin(2*np.pi*f*3.99*t)*np.exp(-t/.1)
 elif kind=='bass':s=(np.sin(2*np.pi*f*t)+.18*np.sin(4*np.pi*f*t))*np.exp(-t/.7)
 else:s=(np.sin(2*np.pi*f*t)+.13*np.sin(2*np.pi*f*1.003*t)+.1*np.sin(4*np.pi*f*t))*np.sin(np.pi*np.minimum(t/length,1))**.5
 return s*np.minimum(t/.014,1)*np.minimum((length-t)/.08,1)*vel
chords=[[53,57,60,64,67],[52,55,60,64],[50,53,57,60,64],[46,53,57,62],[53,57,60,64],[48,55,60,62],[50,53,57,60],[46,53,57,62],[53,57,60,64,67],[48,55,60,64],[46,53,57,62],[53,57,60,64,67]]
melody=[[69,72,76,72],[67,69,72,67],[65,69,72,69],[65,69,74,72],[69,72,76,79],[76,74,72,67],[69,72,76,72],[74,72,69,65],[72,76,79,76],[74,72,67,64],[65,69,72,74],[72,69,65,65]]
for bar,chord in enumerate(chords):
 start=bar*4*beat
 # soft, spread piano voicing
 for j,n in enumerate(chord):add(tone(n,2.8,'keys'),start+j*.024,.07,(-1 if j%2 else 1)*.24)
 for j in range(4):
  n=chord[j%len(chord)]+12
  add(tone(n,1.4,'keys'),start+(j+.5)*beat,.043,-.32)
 for pos,n in zip([0,.75,2,2.75],melody[bar]):add(tone(n,1.6,'bell'),start+pos*beat,.065,.28)
 for pos,n in [(0,chord[0]-12),(2,chord[0]-12+7)]:add(tone(n,1.3,'bass'),start+pos*beat,.14,-.06)
 if bar>0:
  for k in range(8):
   t=np.arange(int(sr*.07))/sr;noise=rng.normal(0,1,len(t));noise=noise-np.concatenate(([0],noise[:-1]))*.8
   add(noise*np.exp(-t/.017),start+k*.5*beat,.006 if k%2 else .01,.43)
  for k in [1,3]:
   t=np.arange(int(sr*.16))/sr;noise=rng.normal(0,1,len(t));smooth=np.convolve(noise,np.ones(10)/10,mode='same')
   add(smooth*np.exp(-t/.055),start+k*beat,.055,-.24)
  for k in [0,2]:
   t=np.arange(int(sr*.22))/sr;phase=2*np.pi*(48*t+50*.018*(1-np.exp(-t/.018)))
   add(np.sin(phase)*np.exp(-t/.05),start+k*beat,.13,0)
# short diffuse room: original dry bus into stereo reflection taps
dry=mix.copy()
for delay,gain in [(.047,.12),(.083,.08),(.139,.065),(.213,.05),(.337,.025)]:
 d=int(delay*sr);mix[d:,0]+=dry[:-d,1]*gain;mix[d:,1]+=dry[:-d,0]*gain
mix=mix[:int(sr*duration)]
t=np.arange(len(mix))/sr;mix*=np.minimum(t/.3,1)[:,None];mix*=np.minimum((duration-t)/1.1,1).clip(0,1)[:,None]
mix=np.tanh(mix*1.1);mix*=.79/max(abs(mix).max(),.001)
raw=out/'island-hours-original.wav'
with wave.open(str(raw),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((mix*32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg','-v','error','-y','-i',str(raw),'-af','loudnorm=I=-19:TP=-1.5:LRA=7','-ar','48000',str(out/'island-hours-master.wav')],check=True)
(out/'music-notes.json').write_text(json.dumps({'title':'Island Hours','composer':'Original procedural composition for Hyper Dimension','duration':30,'bpm':96,'meter':'4/4','bars':12,'instruments':['soft tine piano','mallet melody','rounded bass','brushed percussion'],'samples':'All sounds synthesized here; no third-party recording, melody quotation or voice','license':'MIT, as first-party project media'},indent=2),encoding='utf8')
print('Original 30-second stereo score created, 96 BPM / 12 bars, mastered to -19 LUFS.')
