// audiotool rate            -> print UR44 nominal rate
// audiotool rate <hz>       -> set UR44 nominal rate
// audiotool tone <secs> <ch,ch>  -> play a 440 Hz sine (amplitude $AMP, default 0.02)
//   on the given 0-based output channels of the device named $DEV (default UR44)
import Foundation
import CoreAudio
import AudioToolbox
import AVFoundation

func ur44() -> AudioDeviceID {
  var addr = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDevices, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
  var size: UInt32 = 0
  AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size)
  var ids = [AudioDeviceID](repeating: 0, count: Int(size) / 4)
  AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil, &size, &ids)
  for id in ids {
    var na = AudioObjectPropertyAddress(mSelector: kAudioObjectPropertyName, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
    var name: Unmanaged<CFString>?; var s = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    AudioObjectGetPropertyData(id, &na, 0, nil, &s, &name)
    if let n = name?.takeRetainedValue() as String?, n.contains(ProcessInfo.processInfo.environment["DEV"] ?? "UR44") { return id }
  }
  fatalError("UR44 not found")
}
let dev = ur44()
let a = CommandLine.arguments
var rateAddr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyNominalSampleRate, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
if a[1] == "rate" {
  if a.count > 2 {
    var r = Float64(a[2])!
    let st = AudioObjectSetPropertyData(dev, &rateAddr, 0, nil, UInt32(MemoryLayout<Float64>.size), &r)
    Thread.sleep(forTimeInterval: 2)
    print("set status \(st)")
  }
  var r: Float64 = 0; var s = UInt32(MemoryLayout<Float64>.size)
  AudioObjectGetPropertyData(dev, &rateAddr, 0, nil, &s, &r)
  print("rate \(r)")
} else if a[1] == "tone" {
  let secs = Double(a[2])!
  let chans = Set(a[3].split(separator: ",").map { Int($0)! })
  let amp = Double(ProcessInfo.processInfo.environment["AMP"] ?? "0.02") ?? 0.02
  var desc = AudioComponentDescription(componentType: kAudioUnitType_Output, componentSubType: kAudioUnitSubType_HALOutput, componentManufacturer: kAudioUnitManufacturer_Apple, componentFlags: 0, componentFlagsMask: 0)
  let comp = AudioComponentFindNext(nil, &desc)!
  var au: AudioUnit?
  AudioComponentInstanceNew(comp, &au)
  var d = dev
  print("dev", AudioUnitSetProperty(au!, kAudioOutputUnitProperty_CurrentDevice, kAudioUnitScope_Global, 0, &d, UInt32(MemoryLayout<AudioDeviceID>.size)))
  var r: Float64 = 0; var rs = UInt32(MemoryLayout<Float64>.size)
  AudioObjectGetPropertyData(dev, &rateAddr, 0, nil, &rs, &r)
  let nch: UInt32 = UInt32(ProcessInfo.processInfo.environment["NCH"] ?? "4")!
  var asbd = AudioStreamBasicDescription(mSampleRate: r, mFormatID: kAudioFormatLinearPCM, mFormatFlags: kAudioFormatFlagIsFloat | kAudioFormatFlagIsNonInterleaved | kAudioFormatFlagIsPacked, mBytesPerPacket: 4, mFramesPerPacket: 1, mBytesPerFrame: 4, mChannelsPerFrame: nch, mBitsPerChannel: 32, mReserved: 0)
  print("fmt", AudioUnitSetProperty(au!, kAudioUnitProperty_StreamFormat, kAudioUnitScope_Input, 0, &asbd, UInt32(MemoryLayout<AudioStreamBasicDescription>.size)))
  final class St { var phase = 0.0; var rate = 44100.0; var chans = Set<Int>(); var amp = 0.02 }
  let st = St(); st.rate = r; st.chans = chans; st.amp = amp
  var cb = AURenderCallbackStruct(inputProc: { ref, _, _, _, frames, abl in
    let st = Unmanaged<St>.fromOpaque(ref).takeUnretainedValue()
    let bufs = UnsafeMutableAudioBufferListPointer(abl!)
    for f in 0..<Int(frames) {
      let v = Float(sin(st.phase) * st.amp); st.phase += 2 * .pi * 440 / st.rate
      for (i, b) in bufs.enumerated() { b.mData!.assumingMemoryBound(to: Float.self)[f] = st.chans.contains(i) ? v : 0 }
    }
    return noErr
  }, inputProcRefCon: Unmanaged.passUnretained(st).toOpaque())
  print("cb", AudioUnitSetProperty(au!, kAudioUnitProperty_SetRenderCallback, kAudioUnitScope_Input, 0, &cb, UInt32(MemoryLayout<AURenderCallbackStruct>.size)))
  print("init", AudioUnitInitialize(au!), "start", AudioOutputUnitStart(au!)); fflush(stdout)
  Thread.sleep(forTimeInterval: secs)
  AudioOutputUnitStop(au!)
}
