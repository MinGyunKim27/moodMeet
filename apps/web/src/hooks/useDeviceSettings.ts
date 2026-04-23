import { useEffect, useState, useCallback } from 'react'

export interface DeviceInfo {
  deviceId: string
  label: string
}

export interface DeviceSettings {
  cameraId: string
  micId: string
}

const STORAGE_KEY = 'mm_device_settings'

function loadSettings(): DeviceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as DeviceSettings
  } catch { /* ignore */ }
  return { cameraId: '', micId: '' }
}

function saveSettings(s: DeviceSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function useDeviceSettings() {
  const [settings, setSettingsState] = useState<DeviceSettings>(loadSettings)
  const [cameras, setCameras] = useState<DeviceInfo[]>([])
  const [mics, setMics] = useState<DeviceInfo[]>([])
  const [permissionGranted, setPermissionGranted] = useState(false)

  const enumerateDevices = useCallback(async () => {
    try {
      // 권한 요청 (label을 보려면 필요)
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      setPermissionGranted(true)
      const devices = await navigator.mediaDevices.enumerateDevices()

      setCameras(
        devices
          .filter((d) => d.kind === 'videoinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `카메라 ${i + 1}`,
          })),
      )
      setMics(
        devices
          .filter((d) => d.kind === 'audioinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `마이크 ${i + 1}`,
          })),
      )
    } catch {
      setPermissionGranted(false)
    }
  }, [])

  useEffect(() => { enumerateDevices() }, [enumerateDevices])

  const setSettings = useCallback((patch: Partial<DeviceSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, setSettings, cameras, mics, permissionGranted, enumerateDevices }
}
