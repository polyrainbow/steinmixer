# UR44 MIDI SysEx protocol

Everything below was verified against a real UR44 by probing the device.
The implementation lives in `web/js/devices/UR44-protocol.js` and
`web/js/devices/UR44.js`; `web/js/devices/UR44VirtualDevice.js` models the
device behaviour described here.

The device is controlled via its **second** MIDI port ("Steinberg UR44 Port 2",
localized, e.g. "Anschluss 2").

## Message types

All messages: `F0 43 <type> 3E 14 ... F7`.
In the following, `[u16]` = 3 bytes of 7 bit (`00 hi lo`), `[u32]` = 5 bytes of
7 bit, MSB first, two's complement.

| Message | Bytes |
|---|---|
| Parameter change (both directions) | `F0 43 10 3E 14 01 01 [id u16] [ch u16] [value u32] F7` |
| Parameter change + re-apply | `F0 43 10 3E 14 01 03 ...` same as above. Used for the morph value after changing the morphing table. |
| Parameter query | `F0 43 30 3E 14 01 01 [id u16] [ch u16] F7` → answered with a parameter change |
| Bulk dump request | `F0 43 20 3E 14 01 01 [type u32] F7` with type 1 = CurrentScene, 3 = All (2 = MorphingTable is not answered) |
| Bulk dump (both directions) | `F0 43 00 3E <size u14> 14 01 01 [type u32] <packed payload> <checksum> F7` |
| Bulk dump received (ack) | `F0 43 10 3E 14 03 02 02 00 00 00 00 <type> F7` |
| Store current state in device memory | `F0 43 30 3E 14 03 02 01 00 00 01 F7`, ack `F0 43 10 3E 14 03 02 01 00 00 01 F7` |
| Insert effect | `F0 43 10 3E 14 03 08 01 <fx> [ch u16] <insertPoint> F7`, fx 0 = channel strip, 1 = guitar amp; insertPoint 0 = INS.FX, 1 = MON.FX |
| Remove effect | `F0 43 10 3E 14 03 08 02 <fx> [ch u16] F7` |
| Meters on / off | `F0 43 30 3E 14 02 02 32 7F F7` / `... 32 00 F7` |
| Meters | `F0 43 10 3E 14 02 02` + 44 values of 3 bytes + `F7` (140 bytes) |

Bulk dump details: `size` = message length − 9; checksum = two's complement of
the sum of all bytes from byte 7 up to the last payload byte (mod 128).
The payload is 8-to-7 packed: 7 data bytes followed by one byte containing their
MSBs (bit 6 = first byte).

The unpacked payload consists of two blocks, each with a 32 byte header (16 byte
name, …, 2 byte body length at offset 30): `F_<name>` (format) and `D_<name>`
(data). The format block lists groups (`80 01 <count u16>`: number of
elements, e.g. 6 input channels) and their params (`idHi idLo flags size`,
flags 0x01 = unsigned, 0x40 = array → 2 more bytes: values per element).
The data block contains the values in exactly that order, big endian, `size`
bytes each. So dumps are self-describing; see `parseBulkDump`.

Dump "All" contains every param except 25–27; "CurrentScene" additionally
lacks 34–36, 38–41 and 100 (phones/meters/loopback/sample rate/phantom/input
level), i.e. it contains exactly what dspMixFx stores in a scene, including
the effect assignments and the morphing tables.

## Parameter ids

`ch` is the input channel (0–5), the channel strip (0–3), or an element index.

| id | name | notes |
|---|---|---|
| 0 | ChPairOnf | link; set on either channel of the pair |
| 1 | ChFaderLinkOnf | |
| 2 | ChPhaseOnf | |
| 3, 4 | ChHpfOnf, ChHpfFreq | freq is set on all channels |
| 5, 6 | ChFxInsPrePatch, ChFxInsPostPatch | channel strip on INS.FX / MON.FX: strip index + 1 |
| 7–16 | solo, mute (Onf: 1 = unmuted), send on/off, levels, reverb send, pan of mix 1/2 | |
| 17–24 | DAW solo/mute/level/balance per mix | |
| 25–27 | DawSendFxBusOnf/Level/Bal | DAW → REV-X. **Not in dumps, query them.** |
| 28–33 | Master on/level/balance per mix | |
| 34 | PatchAuxPhoneOutput | phones 2 source |
| 35, 36 | PatchDawMeter, PatchMasterMeter | mix shown by the meters |
| 37 | PatchFxSend | mix whose sends feed REV-X |
| 38 | SysFsCode | sample rate 0–5 = 44.1/48/88.2/96/176.4/192 kHz, read only, **pushed by the device when it changes** |
| 39 | SysSoloOnf | 1 when anything is soloed |
| 40 | HaP48VOnf | phantom power, ch 0 = inputs 1/2, 1 = 3/4, pushed when switched |
| 41 | HaInputGain | ch 2 = input 5/6 level (0 = +4 dBu, 1 = −10 dBV) |
| 42 | FxStereoLinkOnf | per strip, set by the device |
| 43–63 | channel strip (bypass, drive, attack, …, 54 = morph 0–120, …, total gain) | per strip |
| 64–80 | REV-X | |
| 81, 82 | MorphSystemId (4 chars), MorphSystemName (256 chars) | per strip; a param change only writes the first char, use a bulk dump |
| 83–99 | morphing table | ch = strip × 9 + point |
| 100 | PatchLoopbackMode | |
| 101–174 | guitar amp | 102 = amp type |
| 175, 176 | ChGtrFxInsPrePatch, ChGtrFxInsPostPatch | guitar amp on INS.FX / MON.FX |

## Device behaviour

* **Linked channels**: linking copies the left channel's values to the right
  one and turns an existing channel strip into a stereo strip. While linked,
  the device mirrors HPF, solo, mute, mix levels and reverb send between both
  channels (no notification is sent). Phase and pan stay independent.
* **Effect allocation**: 4 channel strips; the guitar amp needs the resources of
  two. Stereo strips (inserted on a linked channel with the normal insert
  command) use two strips and are placed first; a new mono strip is placed in
  front of the other mono strips, existing strips are shifted and keep their
  settings. Removing a strip shifts the following ones down. The guitar amp
  can't be used on linked channels. Invalid inserts are silently ignored, so
  always read the state back (dump) after inserting/removing.
* **Stereo strips**: parameter changes on either strip are mirrored to the
  other one.
* **Morphing**: the device interpolates compressor/EQ values from the 9 point
  table when the morph value (id 54) changes: `pos = v / 15`,
  `value = trunc(a + (b − a) × (pos − floor(pos)))`. After writing a new table,
  re-send the morph value with the `01 03` variant to apply it.
* **Sample rate**: at 176.4/192 kHz the device removes all effects and rejects
  inserts. They are not restored when switching back.
* **Scenes** are stored on the host (dspMixFx keeps 20 slots). Recall: remove all
  effects, send the stored CurrentScene dump, then the store command.

## Meters

44 values of 21 bit, starting at byte 7, alternating level and peak. Only the
lower 13 bits are the level, upper bits are flags (over, compressor active).
Scale: `dB = (value − 8191) / 102.4` (80 dB range, 8191 = 0 dBFS).

| values | meaning |
|---|---|
| 0–11 | analog inputs 1–6 |
| 12–15 | DAW L/R |
| 16–19 | master L/R |
| 20, 22, 24, 26 | gain reduction of channel strip 0–3 (8191 = 0 dB) |
| 28, 30, 32, 34 | output of channel strip 0–3 |
| 36, 38 / 40, 42 | guitar amp input L/R / output L/R |

## Sweet Spot Data files (.ssd)

512 bytes: `"SSMD"`, version bytes `01 00 00 00` at 0x08, 4 char id at 0x10,
9 points at 0x20 + p × 0x28 with 17 big endian u16 each (morphing table order,
ids 83–99). The name is the file name. See `web/js/devices/sweetSpotData.js`.
