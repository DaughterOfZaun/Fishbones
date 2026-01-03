import { PickableValue } from "./data/constants/values/pickable"
import { InputableValue } from "./data/constants/values/inputable"
import { Enabled } from "./data/constants/values/enabled"
import { ValueDesc } from "./data/constants/values/desc"
import { tr } from "./translation"

export type u = undefined

export const LOBBY_PROTOCOL = `/lobby/${0}`
export const PROXY_PROTOCOL = `/proxy/${0}`
export const LOCALHOST = '127.0.0.1'

export class GameType extends PickableValue {
    public static readonly choices = [
        { value: 0, name: tr('Blind Pick') },
        { value: 1, name: tr('Draft Pick') },
        { value: 2, name: tr('All Random') },
    ]
}

const teams = [
    { i: 0, short: 'Blue', name: tr("Blue") },
    { i: 1, short: 'Purple', name: tr("Purple") },
    { i: 2, short: 'Neutral', name: tr("Neutral") },
]
export class Team extends PickableValue {
    public static readonly name = tr('Team')
    public static values = teams.map(({ short }) => short)
    public static readonly choices = teams.map(({ i, short, name }) => ({ value: i, short, name }))
    public static readonly count = 2

    static colors = [ 'blueBright', 'redBright', 'greenBright', 'yellowBright', 'magentaBright', 'cyanBright', 'white' ] as const
    public color(): (typeof Team.colors)[number] | 'gray' {
        return (this.value != undefined) ? Team.colors[this.value] ?? 'white' : 'gray'
    }

    public get index(){ return this.value ?? -1 }
}

export class Lock extends PickableValue {
    public static readonly name = tr('Lock')
    public static readonly values = [ tr("Unlocked"), tr("Locked") ]
    public static readonly choices = PickableValue.normalize(Lock.values)
}

export class BooleanValue extends ValueDesc<boolean, boolean>{
    encode(): boolean {
        return this.value!
    }
    decodeInplace(v: boolean): boolean {
        this.value = v
        return true
    }
}

export class FloatValue extends ValueDesc<number, number>{
    encode(): number {
        return this.value!
    }
    decodeInplace(v: number): boolean {
        this.value = v
        return true
    }
}

export class HexStringValue extends ValueDesc<string, Uint8Array> {
    encode(): Uint8Array {
        return Uint8Array.fromHex(this.value!)
    }
    decodeInplace(v: Uint8Array): boolean {
        this.value = v.toHex()
        return true
    }
}

export class PlayerCount extends PickableValue {
    public static readonly name = tr('Player Count')
    //public static values = Array(6).fill(0).map((v, i) => `${i + 1}v${i + 1}`)
    public static values = Object.fromEntries(Array(6).fill(0).map((v, i) => [ ++i, tr(`{i}v{i}`, { i })]))
    public static readonly choices = PickableValue.normalize(PlayerCount.values)
}

export class TickRate extends PickableValue {
    public static readonly name = tr('Tick Rate')
    //public static values = [15, 30, 60, 120].map(v => `${v} fps`)
    public static values = Object.fromEntries([15, 30, 60, 120].map(v => [ v, tr(`{v} fps`, { v })]))
    public static readonly choices = PickableValue.normalize(TickRate.values)
}

export class Password extends InputableValue {
    public static readonly name = tr('Password')
    public constructor(){ super(Password.name) }
    public toString(): string {
        return this.value?.replace(/./g, '*') ?? tr('undefined')
    }
    public get isSet(){ return this.value != undefined && this.value != '' }
}

export class Name extends InputableValue {
    public static readonly name = tr('Name')
    public constructor(value: string){ super(Name.name, value) }
    public toString(): string {
        return this.value ?? tr('undefined')
    }
}

export class Rank extends PickableValue {
    public static readonly name = tr('Rank')
    public static readonly values = [
        //"",
        tr("BRONZE"),
        tr("GOLD"),
        tr("PLATINUM"),
        tr("SILVER"),
        tr("UNRANKED"),
    ]
    public static random(){
        return this.values[Math.floor(Math.random() * this.values.length)]!
    }
}

export const blowfishKey = "17BLOhi6KZsTtldTsizvHg=="
export function sanitize_bfkey(v: string){
    return v.replace(/[^a-zA-Z0-9=]/g, '')
}

export enum Features {
    CHEATS_ENABLED = 1 << 0,
    MANACOSTS_DISABLED = 1 << 1,
    COOLDOWNS_DISABLED = 1 << 2,
    MINIONS_DISABLED = 1 << 3,
    HALF_PING_MODE_ENABLED = 1 << 4,
}

export class FeaturesEnabled extends Enabled {
    public static readonly name = tr(`Features Enabled`)
    public static readonly values = {
        [Features.CHEATS_ENABLED]: tr('Enable Cheats'),
        [Features.MANACOSTS_DISABLED]: tr('Disable Manacosts'),
        [Features.COOLDOWNS_DISABLED]: tr('Disable Cooldowns'),
        [Features.MINIONS_DISABLED]: tr('Disable Minions'),
        [Features.HALF_PING_MODE_ENABLED]: tr('Enable Half-Ping Mode'),
    }
    public static readonly choices = PickableValue.normalize(FeaturesEnabled.values)
    
    public get isCheatsEnabled(){ return this.value.includes(Features.CHEATS_ENABLED) }
    public get isManacostsEnabled(){ return !this.value.includes(Features.MANACOSTS_DISABLED) }
    public get isCooldownsEnabled(){ return !this.value.includes(Features.COOLDOWNS_DISABLED) }
    public get isMinionsEnabled(){ return !this.value.includes(Features.MINIONS_DISABLED) }
    public get isHalfPingEnabled(){ return this.value.includes(Features.HALF_PING_MODE_ENABLED) }
}
