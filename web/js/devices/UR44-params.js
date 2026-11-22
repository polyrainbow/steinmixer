export default `
# paramName,paramNumber,channel,min,max,default,readOnly,description

Input0Link,0,0,0,1,0,false,0:off; 1:input1+input2 linked - ch0/ch2/ch4 only
Input2Link,0,2,0,1,0,false,0:off; 1:input1+input2 linked - ch0/ch2/ch4 only
Input4Link,0,4,0,1,0,false,0:off; 1:input1+input2 linked - ch0/ch2/ch4 only

Input0InvertPhase,2,0,0,1,0,false,0:normal; 1:inverted
Input1InvertPhase,2,1,0,1,0,false,0:normal; 1:inverted
Input2InvertPhase,2,2,0,1,0,false,0:normal; 1:inverted
Input3InvertPhase,2,3,0,1,0,false,0:normal; 1:inverted
Input4InvertPhase,2,4,0,1,0,false,0:normal; 1:inverted
Input5InvertPhase,2,5,0,1,0,false,0:normal; 1:inverted

Input0HPFEnabled,3,0,0,1,0,false,0:off; 1:on
Input1HPFEnabled,3,1,0,1,0,false,0:off; 1:on
Input2HPFEnabled,3,2,0,1,0,false,0:off; 1:on
Input3HPFEnabled,3,3,0,1,0,false,0:off; 1:on

# the "+" syntax means that we have to set multiple channels simultaneously even though it is just one setting
InputHPFSetting,4,0+1+2+3+4+5,0,4,2,false,0:40Hz; 1:60Hz; 2:80Hz; 3:100Hz; 4:120Hz

Mix0Input0Solo,7,0,0,1,0,false,0:unsolo; 1:solo
Mix0Input1Solo,7,1,0,1,0,false,0:unsolo; 1:solo
Mix0Input2Solo,7,2,0,1,0,false,0:unsolo; 1:solo
Mix0Input3Solo,7,3,0,1,0,false,0:unsolo; 1:solo
Mix0Input4Solo,7,4,0,1,0,false,0:unsolo; 1:solo
Mix0Input5Solo,7,5,0,1,0,false,0:unsolo; 1:solo

Mix1Input0Solo,8,0,0,1,0,false,0:unsolo; 1:solo
Mix1Input1Solo,8,1,0,1,0,false,0:unsolo; 1:solo
Mix1Input2Solo,8,2,0,1,0,false,0:unsolo; 1:solo
Mix1Input3Solo,8,3,0,1,0,false,0:unsolo; 1:solo
Mix1Input4Solo,8,4,0,1,0,false,0:unsolo; 1:solo
Mix1Input5Solo,8,5,0,1,0,false,0:unsolo; 1:solo

Mix0Input0Mute,9,0,0,1,1,false,0:mute; 1:unmute
Mix0Input1Mute,9,1,0,1,1,false,0:mute; 1:unmute
Mix0Input2Mute,9,2,0,1,1,false,0:mute; 1:unmute
Mix0Input3Mute,9,3,0,1,1,false,0:mute; 1:unmute
Mix0Input4Mute,9,4,0,1,1,false,0:mute; 1:unmute
Mix0Input5Mute,9,5,0,1,1,false,0:mute; 1:unmute

Mix1Input0Mute,10,0,0,1,1,false,0:mute; 1:unmute
Mix1Input1Mute,10,1,0,1,1,false,0:mute; 1:unmute
Mix1Input2Mute,10,2,0,1,1,false,0:mute; 1:unmute
Mix1Input3Mute,10,3,0,1,1,false,0:mute; 1:unmute
Mix1Input4Mute,10,4,0,1,1,false,0:mute; 1:unmute
Mix1Input5Mute,10,5,0,1,1,false,0:mute; 1:unmute

Mix0Input0Volume,12,0,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0Input1Volume,12,1,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0Input2Volume,12,2,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0Input3Volume,12,3,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0Input4Volume,12,4,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0Input5Volume,12,5,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB

Mix1Input0Volume,13,0,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1Input1Volume,13,1,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1Input2Volume,13,2,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1Input3Volume,13,3,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1Input4Volume,13,4,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1Input5Volume,13,5,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB

Input0ReverbSend,14,0,0,127,0,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Input1ReverbSend,14,1,0,127,0,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Input2ReverbSend,14,2,0,127,0,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Input3ReverbSend,14,3,0,127,0,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Input4ReverbSend,14,4,0,127,0,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Input5ReverbSend,14,5,0,127,0,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB

Mix0Input0Pan,15,0,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix0Input1Pan,15,1,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix0Input2Pan,15,2,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix0Input3Pan,15,3,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix0Input4Pan,15,4,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix0Input5Pan,15,5,-16,16,0,false,-16:L16; 0:C; 16:R16

Mix1Input0Pan,16,0,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix1Input1Pan,16,1,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix1Input2Pan,16,2,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix1Input3Pan,16,3,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix1Input4Pan,16,4,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix1Input5Pan,16,5,-16,16,0,false,-16:L16; 0:C; 16:R16

Mix0DAWSolo,17,null,0,1,0,false,0:unsolo; 1:solo
Mix1DAWSolo,18,null,0,1,0,false,0:unsolo; 1:solo
Mix0DAWMute,19,null,0,1,1,false,0:mute; 1:unmute
Mix1DAWMute,20,null,0,1,1,false,0:mute; 1:unmute
Mix0DAWVolume,21,null,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1DAWVolume,22,null,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0DAWPan,23,null,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix1DAWPan,24,null,-16,16,0,false,-16:L16; 0:C; 16:R16

# DAW signal sent to the REV-X (FX bus). Not contained in bulk dumps,
# must be queried.
DAWReverbSendEnabled,25,null,0,1,0,false,0:off; 1:on
DAWReverbSend,26,null,0,127,0,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
DAWReverbSendBalance,27,null,-16,16,0,false,-16:L16; 0:C; 16:R16

Mix0MainMute,28,null,0,1,1,false,0:mute; 1:unmute
Mix1MainMute,29,null,0,1,1,false,0:mute; 1:unmute
Mix0MainVolume,30,null,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1MainVolume,31,null,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB

Mix0MainPan,32,null,-16,16,0,false,-16:L16; 0:C; 16:R16
Mix1MainPan,33,null,-16,16,0,false,-16:L16; 0:C; 16:R16

Phones2Output,34,null,0,1,0,false,0:Mix 1; 1:Mix 2
Loopback,100,null,0,1,0,false,0:off; 1:on
Input45Level,41,2,0,1,0,false,0:+4dBu; 1:-10dBV
SampleRate,38,null,0,5,0,true,0:44.1kHz; 1:48kHz; 2:88.2kHz; 3:96kHz; 4:176.4kHz; 5:192kHz
SoloActive,39,null,0,1,0,true,0:no channel soloed; 1:some channel soloed

ReverbType,65,null,0,2,0,false,0:Hall; 1:Room; 2:Plate
ReverbTime,66,null,0,69,23,false,0:0.289; 69:29.0; 23:2.51; 40:4.15
ReverbDiffusion,67,null,0,10,10,false,
ReverbInitialDelay,68,null,0,127,2,false,0:0.1ms; 2:3.2ms; 127:200.0ms
ReverbHPF,69,null,0,52,4,false,0:20Hz; 4:32Hz; 52:8.0kHz
ReverbLPF,70,null,34,60,50,false,34:1kHz; 50:6.3kHz; 60:20kHz
ReverbRoomSize,71,null,0,31,29,false,
ReverbHighRatio,72,null,1,10,8,false,1:0.1; 8:0.8; 10:1.0
ReverbLowRatio,73,null,1,14,12,false,1:0.1; 12:1.2; 14:1.4
ReverbDecay,74,null,0,63,27,false,
ReverbLowFreq,76,null,1,59,32,false,1:22Hz; 32:800Hz; 59:18kHz
Mix0ReverbVolume,79,null,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1ReverbVolume,80,null,0,127,103,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB

ReverbInputMix,37,null,0,1,0,false,0:mix1; 1:mix2

PhantomPower01,40,0,0,1,null,true,0:off; 1:on
PhantomPower23,40,1,0,1,null,true,0:off; 1:on

ChannelStripStereoLink,42,stack,0,1,0,true,0:mono; 1:stereo (set by device)
ChannelStripCompEnabled,43,stack,0,1,0,false,0:on; 1:off (bypass)
ChannelStripCompDrive,44,stack,0,200,100,false,0:0.00; 100:5.00; 200:10.00
ChannelStripCompAttack,45,stack,57,283,184,false,57:0.092ms; 184:4.122ms; 283:80.00ms
ChannelStripCompRelease,46,stack,24,300,159,false,24:9.3ms; 159:92.0ms; 300:999.0ms
ChannelStripCompRatio,47,stack,0,120,30,false,0:1.00; 30:2.50; 60:4.0.0; 90:14.0; 120:inf
ChannelStripCompKnee,48,stack,0,2,1,false,0:soft; 1:medium; 2:hard
ChannelStripCompThreshOffset,49,stack,0,200,100,false,morph table only
ChannelStripCompMakeupOffset,50,stack,0,200,70,false,morph table only
ChannelStripCompSideChFreq,51,stack,4,124,30,false,4:20Hz; 30:90.0Hz; 124:20kHz
ChannelStripCompSideChGain,52,stack,0,360,133,false,0:-18.0dB; 133:-4.7dB; 360:18dB
ChannelStripCompSideChQ,53,stack,0,60,12,false,0:0.50; 12:1.00; 60:16
ChannelStripMorphing,54,stack,0,120,0,false,0:0.00; 60:5.00; 120:10.00
ChannelStripEQEnabled,55,stack,0,1,0,false,0:on; 1:off (bypass)
ChannelStripEQHighFreq,56,stack,60,124,112,false,60:500Hz; 112:10.0kHz; 124:20.0kHz
ChannelStripEQHighGain,57,stack,0,360,180,false,0:-18dB; 180:0.0dB; 360:18dB
ChannelStripEQMidFreq,58,stack,4,124,71,false,4:20Hz; 71:950Hz; 72:1.00kHz; 124:20kHz
ChannelStripEQMidGain,59,stack,0,360,180,false,0:-18dB; 180:0.0dB; 360:18dB
ChannelStripEQMidQ,60,stack,0,60,12,false,0:0.50; 12:1.00; 60:16
ChannelStripEQLowFreq,61,stack,4,72,32,false,4:20Hz; 32:100Hz; 72:1kHz
ChannelStripEQLowGain,62,stack,0,360,180,false,0:-18dB; 180:0.0dB; 360:18dB
ChannelStripTotalGain,63,stack,0,360,180,false,0:-18dB; 180:0.0dB; 360:18dB

AmpType,102,null,0,3,0,false,0:Clean; 1:Crunch; 2:Lead; 3:Drive

AmpCleanVolume,104,null,0,64,32,false,
AmpCleanDistortion,105,null,0,64,32,false,
AmpCleanModulation,116,null,0,2,1,false,0:Chorus; 1:off; 2:Vibrato,
AmpCleanVibratoSpeed,117,null,0,64,32,false,
AmpCleanVibratoDepth,118,null,0,64,32,false,
AmpCleanTreble,108,null,0,64,32,false,
AmpCleanMiddle,107,null,0,64,32,false,
AmpCleanBass,106,null,0,64,32,false,
AmpCleanPresence,109,null,0,64,32,false,
AmpCleanBlend,103,null,0,64,32,false,
AmpCleanOutput,111,null,0,127,32,false,

AmpCrunchMode,121,null,0,1,1,false,0: Normal; 1: Bright
AmpCrunchGain,122,null,0,64,32,false,
AmpCrunchTreble,126,null,0,64,32,false,
AmpCrunchMiddle,125,null,0,64,32,false,
AmpCrunchBass,124,null,0,64,32,false,
AmpCrunchPresence,127,null,0,64,32,false,
AmpCrunchOutput,129,null,0,127,32,false,

AmpLeadType,139,null,0,5,1,false,0:High; 1:Low
AmpLeadGain,140,null,0,64,32,false,
AmpLeadMaster,146,null,0,64,32,false,
AmpLeadTreble,144,null,0,64,32,false,
AmpLeadMiddle,143,null,0,64,32,false,
AmpLeadBass,142,null,0,64,32,false,
AmpLeadPresence,145,null,0,64,32,false,
AmpLeadOutput,147,null,0,127,32,false,

AmpDriveType,157,null,0,5,1,false,
AmpDriveGain,158,null,0,64,32,false,
AmpDriveMaster,164,null,0,64,32,false,
AmpDriveTreble,162,null,0,64,32,false,
AmpDriveMiddle,161,null,0,64,32,false,
AmpDriveBass,160,null,0,64,32,false,
AmpDrivePresence,163,null,0,64,32,false,
AmpDriveOutput,165,null,0,127,32,false,
`;
