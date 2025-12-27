import { downloads } from "../fs"
import path from 'node:path'

export const winePkg = new class WinePkg {
    exe = path.join(downloads, 'wine-proton_10.0-3-x86_64.AppImage')
}
