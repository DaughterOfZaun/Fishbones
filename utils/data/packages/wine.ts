import { downloads } from "../fs"
import path from 'node:path'

export const winePkg = new class WinePkg {
    exe = path.join(downloads, 'wine-stable_10.0-x86_64.AppImage')
}
