// Bidirectional bridge: hex lines on stdin are sent to UR44 port 2,
// every received SysEx is printed as one hex line on stdout.
import Foundation
import CoreMIDI
func find(_ count: Int, _ get: (Int) -> MIDIEndpointRef) -> MIDIEndpointRef? {
  for i in 0..<count {
    let ep = get(i); var name: Unmanaged<CFString>?
    MIDIObjectGetStringProperty(ep, kMIDIPropertyDisplayName, &name)
    let n = (name?.takeRetainedValue() as String?) ?? ""
    if n.contains("UR44") && n.hasSuffix("2") { return ep }
  }
  return nil
}
var client = MIDIClientRef(); MIDIClientCreate("bridge" as CFString, nil, nil, &client)
guard let src = find(MIDIGetNumberOfSources(), MIDIGetSource), let dst = find(MIDIGetNumberOfDestinations(), MIDIGetDestination) else { FileHandle.standardError.write("no UR44\n".data(using: .utf8)!); exit(1) }
var buf: [UInt8] = []; let lock = NSLock()
var inPort = MIDIPortRef()
MIDIInputPortCreateWithBlock(client, "in" as CFString, &inPort) { list, _ in
  for pkt in list.unsafeSequence() {
    let bytes = Array(UnsafeRawBufferPointer(start: UnsafeRawPointer(pkt).advanced(by: MemoryLayout<MIDIPacket>.offset(of: \MIDIPacket.data)!), count: Int(pkt.pointee.length)).bindMemory(to: UInt8.self))
    lock.lock()
    for b in bytes { if b == 0xF0 { buf = [b] } else { buf.append(b) }
      if b == 0xF7 { print(buf.map { String(format: "%02x", $0) }.joined(separator: " ")); fflush(stdout); buf = [] } }
    lock.unlock()
  }
}
MIDIPortConnectSource(inPort, src, nil)
var outPort = MIDIPortRef(); MIDIOutputPortCreate(client, "out" as CFString, &outPort)
DispatchQueue.global().async {
  while let line = readLine() {
    let bytes = line.split(separator: " ").compactMap { UInt8($0, radix: 16) }
    if bytes.isEmpty { continue }
    let cap = bytes.count + 1024
    let raw = UnsafeMutableRawPointer.allocate(byteCount: cap, alignment: 8)
    let pl = raw.bindMemory(to: MIDIPacketList.self, capacity: 1)
    var p = MIDIPacketListInit(pl); p = MIDIPacketListAdd(pl, cap, p, 0, bytes.count, bytes)
    MIDISend(outPort, dst, pl); raw.deallocate()
  }
  exit(0)
}
RunLoop.main.run()
