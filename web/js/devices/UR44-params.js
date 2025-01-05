export default `
# paramName,paramNumber,channel,min,max,default,initMessageIndex,readOnly,description

Input0Link,0,0,0,1,0,937,false,0:off; 1:input1+input2 linked - ch0/ch2/ch4 only
Input2Link,0,2,0,1,0,939,false,0:off; 1:input1+input2 linked - ch0/ch2/ch4 only
Input4Link,0,4,0,1,0,942,false,0:off; 1:input1+input2 linked - ch0/ch2/ch4 only

Input0InvertPhase,2,0,0,1,0,951,false,0:normal; 1:inverted
Input1InvertPhase,2,1,0,1,0,952,false,0:normal; 1:inverted
Input2InvertPhase,2,2,0,1,0,953,false,0:normal; 1:inverted
Input3InvertPhase,2,3,0,1,0,954,false,0:normal; 1:inverted
Input4InvertPhase,2,4,0,1,0,955,false,0:normal; 1:inverted
Input5InvertPhase,2,5,0,1,0,956,false,0:normal; 1:inverted

Input0HPFEnabled,3,0,0,1,0,958,false,0:off; 1:on
Input1HPFEnabled,3,1,0,1,0,959,false,0:off; 1:on
Input2HPFEnabled,3,2,0,1,0,960,false,0:off; 1:on
Input3HPFEnabled,3,3,0,1,0,961,false,0:off; 1:on

# the "+" syntax means that we have to set multiple channels simultaneously even though it is just one setting
InputHPFSetting,4,0+1+2+3+4+5,0,4,2,964,false,0:40Hz; 1:60Hz; 2:80Hz; 3:100Hz; 4:120Hz

Mix0Input0Solo,7,0,0,1,0,999,false,0:unsolo; 1:solo
Mix0Input1Solo,7,1,0,1,0,1000,false,0:unsolo; 1:solo
Mix0Input2Solo,7,2,0,1,0,1001,false,0:unsolo; 1:solo
Mix0Input3Solo,7,3,0,1,0,1002,false,0:unsolo; 1:solo
Mix0Input4Solo,7,4,0,1,0,1003,false,0:unsolo; 1:solo
Mix0Input5Solo,7,5,0,1,0,1004,false,0:unsolo; 1:solo

Mix1Input0Solo,8,0,0,1,0,1006,false,0:unsolo; 1:solo
Mix1Input1Solo,8,1,0,1,0,1007,false,0:unsolo; 1:solo
Mix1Input2Solo,8,2,0,1,0,1008,false,0:unsolo; 1:solo
Mix1Input3Solo,8,3,0,1,0,1009,false,0:unsolo; 1:solo
Mix1Input4Solo,8,4,0,1,0,1010,false,0:unsolo; 1:solo
Mix1Input5Solo,8,5,0,1,0,1011,false,0:unsolo; 1:solo

Mix0Input0Mute,9,0,0,1,1,1012,false,0:mute; 1:unmute
Mix0Input1Mute,9,1,0,1,1,1014,false,0:mute; 1:unmute
Mix0Input2Mute,9,2,0,1,1,1015,false,0:mute; 1:unmute
Mix0Input3Mute,9,3,0,1,1,1016,false,0:mute; 1:unmute
Mix0Input4Mute,9,4,0,1,1,1017,false,0:mute; 1:unmute
Mix0Input5Mute,9,5,0,1,1,1018,false,0:mute; 1:unmute

Mix1Input0Mute,10,0,0,1,1,1019,false,0:mute; 1:unmute
Mix1Input1Mute,10,1,0,1,1,1020,false,0:mute; 1:unmute
Mix1Input2Mute,10,2,0,1,1,1022,false,0:mute; 1:unmute
Mix1Input3Mute,10,3,0,1,1,1023,false,0:mute; 1:unmute
Mix1Input4Mute,10,4,0,1,1,1024,false,0:mute; 1:unmute
Mix1Input5Mute,10,5,0,1,1,1025,false,0:mute; 1:unmute

Mix0Input0Volume,12,0,0,127,103,1033,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0Input1Volume,12,1,0,127,103,1034,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0Input2Volume,12,2,0,127,103,1035,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0Input3Volume,12,3,0,127,103,1036,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0Input4Volume,12,4,0,127,103,1038,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0Input5Volume,12,5,0,127,103,1039,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB

Mix1Input0Volume,13,0,0,127,103,1040,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1Input1Volume,13,1,0,127,103,1041,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1Input2Volume,13,2,0,127,103,1042,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1Input3Volume,13,3,0,127,103,1043,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1Input4Volume,13,4,0,127,103,1044,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1Input5Volume,13,5,0,127,103,1046,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB

Input0ReverbSend,14,0,0,127,0,1047,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Input1ReverbSend,14,1,0,127,0,1048,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Input2ReverbSend,14,2,0,127,0,1049,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Input3ReverbSend,14,3,0,127,0,1050,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Input4ReverbSend,14,4,0,127,0,1051,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Input5ReverbSend,14,5,0,127,0,1052,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB

Mix0Input0Pan,15,0,-16,16,0,1054,false,-16:L16; 0:C; 16:R16
Mix0Input1Pan,15,1,-16,16,0,1055,false,-16:L16; 0:C; 16:R16
Mix0Input2Pan,15,2,-16,16,0,1056,false,-16:L16; 0:C; 16:R16
Mix0Input3Pan,15,3,-16,16,0,1057,false,-16:L16; 0:C; 16:R16
Mix0Input4Pan,15,4,-16,16,0,1058,false,-16:L16; 0:C; 16:R16
Mix0Input5Pan,15,5,-16,16,0,1059,false,-16:L16; 0:C; 16:R16

Mix1Input0Pan,16,0,-16,16,0,1060,false,-16:L16; 0:C; 16:R16
Mix1Input1Pan,16,1,-16,16,0,1062,false,-16:L16; 0:C; 16:R16
Mix1Input2Pan,16,2,-16,16,0,1063,false,-16:L16; 0:C; 16:R16
Mix1Input3Pan,16,3,-16,16,0,1064,false,-16:L16; 0:C; 16:R16
Mix1Input4Pan,16,4,-16,16,0,1065,false,-16:L16; 0:C; 16:R16
Mix1Input5Pan,16,5,-16,16,0,1066,false,-16:L16; 0:C; 16:R16

Mix0DAWSolo,17,null,0,1,0,1067,false,0:unsolo; 1:solo
Mix1DAWSolo,18,null,0,1,0,1068,false,0:unsolo; 1:solo
Mix0DAWMute,19,null,0,1,1,1070,false,0:mute; 1:unmute
Mix1DAWMute,20,null,0,1,1,1071,false,0:mute; 1:unmute
Mix0DAWVolume,21,null,0,127,103,1072,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1DAWVolume,22,null,0,127,103,1073,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix0DAWPan,23,null,-16,16,0,1074,false,-16:L16; 0:C; 16:R16
Mix1DAWPan,24,null,-16,16,0,1075,false,-16:L16; 0:C; 16:R16

Mix0MainMute,28,null,0,1,1,3489,false,0:mute; 1:unmute
Mix1MainMute,29,null,0,1,1,3490,false,0:mute; 1:unmute
Mix0MainVolume,30,null,0,127,103,3491,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1MainVolume,31,null,0,127,103,3492,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB

Mix0MainPan,32,null,-16,16,0,3494,false,-16:L16; 0:C; 16:R16
Mix1MainPan,33,null,-16,16,0,3495,false,-16:L16; 0:C; 16:R16

Phones2Output,34,null,0,1,0,3496,false,0:Mix 1; 1:Mix 2
Loopback,100,null,0,1,0,3499,false,0:off; 1:on
Input45Level,41,null,0,1,0,3507,false,0:+4dBu; 1:-10dBV

ReverbType,65,null,0,2,0,3386,false,0:Hall; 1:Room; 2:Plate
ReverbTime,66,null,0,69,23,3387,false,0:0.289; 69:29.0; 23:2.51; 40:4.15
ReverbDiffusion,67,null,0,10,10,3388,false,
ReverbInitialDelay,68,null,0,127,2,3390,false,0:0.1ms; 2:3.2ms; 127:200.0ms
ReverbHPF,69,null,0,52,4,3391,false,0:20Hz; 4:32Hz; 52:8.0kHz
ReverbLPF,70,null,34,60,50,3392,false,34:1kHz; 50:6.3kHz; 60:20kHz
ReverbRoomSize,71,null,0,31,29,3393,false,
ReverbHighRatio,72,null,1,10,8,3394,false,1:0.1; 8:0.8; 10:1.0
ReverbLowRatio,73,null,1,14,12,3395,false,1:0.1; 12:1.2; 14:1.4
ReverbDecay,74,null,0,63,27,3396,false,
ReverbLowFreq,76,null,1,59,32,3399,false,1:22Hz; 32:800Hz; 59:18kHz
Mix0ReverbVolume,79,null,0,127,103,3402,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB
Mix1ReverbVolume,80,null,0,127,103,3403,false,0:-∞; 1:-74dB; 103:0dB; 127:+6dB

ReverbOutputMix,37,null,0,1,0,3500,false,0:mix1; 1:mix2

PhantomPower01,null,null,0,1,null,3504,true,0:off; 1:on
PhantomPower23,null,null,0,1,null,3505,true,0:off; 1:on
`;
