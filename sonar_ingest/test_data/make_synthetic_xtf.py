"""
Builds a minimal, structurally valid .xtf file with a handful of sonar pings,
each carrying a slightly different GPS position, for testing xtf_handler.py
without needing a real (large, licensed) survey file.
"""
import ctypes
import numpy as np
import pyxtf
from pyxtf import XTFFileHeader, XTFPingHeader, XTFPingChanHeader, XTFChannelType

N_PINGS = 8
SAMPLES_PER_PING = 100


def build_file_header() -> XTFFileHeader:
    fh = XTFFileHeader()  # sets FileFormat=0x7B etc. in __init__
    fh.NavUnits = 3  # latlon
    fh.NumberOfSonarChannels = 1
    fh.NumberOfBathymetryChannels = 0
    fh.NumberOfSnippetChannels = 0
    fh.NumberOfForwardLookArrays = 0
    fh.NumberOfEchoStrengthChannels = 0
    fh.NumberOfInterferometryChannels = 0

    chan = fh.ChanInfo[0]
    chan.TypeOfChannel = int(XTFChannelType.stbd)
    chan.SubChannelNumber = 0
    chan.BytesPerSample = 1  # uint8 samples
    chan.SampleFormat = 0  # unused/legacy path -> falls back to BytesPerSample
    chan.ChannelName = b"SidescanSTBD"
    chan.Frequency = 300_000.0  # 300 kHz, plausible side-scan frequency

    return fh


def build_ping(ping_number: int, lat: float, lon: float, depth_m: float,
               heading: float, samples: np.ndarray) -> bytes:
    ph = XTFPingHeader()  # sets MagicNumber=0xFACE via XTFPacketStart.__init__
    ph.HeaderType = 0  # sonar
    ph.SubChannelNumber = 0
    ph.NumChansToFollow = 1

    ph.Year, ph.Month, ph.Day = 2024, 8, 15
    ph.Hour, ph.Minute, ph.Second, ph.HSeconds = 14, 32, ping_number % 60, 0
    ph.PingNumber = ping_number
    ph.EventNumber = ping_number
    ph.SoundVelocity = 1500.0

    ph.SensorYcoordinate = lat  # latitude
    ph.SensorXcoordinate = lon  # longitude
    ph.ShipYcoordinate = lat
    ph.ShipXcoordinate = lon
    ph.SensorDepth = depth_m
    ph.ShipDepth = int(depth_m * 10)  # decimeters
    ph.SensorHeading = heading
    ph.SensorPitch = 1.5
    ph.SensorRoll = -0.8

    pch = XTFPingChanHeader()
    pch.ChannelNumber = 0
    pch.NumSamples = len(samples)
    pch.SlantRange = 30.0
    pch.SecondsPerPing = 0.067
    pch.Frequency = 300  # kHz-ish placeholder

    header_bytes = bytes(ph)
    chan_header_bytes = bytes(pch)
    sample_bytes = samples.astype(np.uint8).tobytes()

    ph.NumBytesThisRecord = len(header_bytes) + len(chan_header_bytes) + len(sample_bytes)
    # Re-serialize now that NumBytesThisRecord is correctly set
    header_bytes = bytes(ph)

    return header_bytes + chan_header_bytes + sample_bytes


def main(out_path="test_data/synthetic_survey.xtf"):
    rng = np.random.default_rng(42)
    fh = build_file_header()

    with open(out_path, "wb") as f:
        f.write(bytes(fh))

        base_lat, base_lon = 25.35210, 71.12340
        for i in range(N_PINGS):
            lat = base_lat + i * 0.00005
            lon = base_lon + i * 0.00005
            depth = 45.0 + 0.1 * i
            heading = 135.0

            samples = (rng.random(SAMPLES_PER_PING) * 255).astype(np.uint8)
            # Inject an artificial "bright return" partway through a couple
            # of pings, simulating a debris-like acoustic reflection.
            if i in (3, 5):
                samples[40:55] = 250

            f.write(build_ping(i, lat, lon, depth, heading, samples))

    print(f"Wrote synthetic XTF file: {out_path} ({N_PINGS} pings)")


if __name__ == "__main__":
    main()
