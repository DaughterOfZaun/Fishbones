import { getBitFlagLE, getX, getZ, vec2, Vector2, Vector3 } from "./math";
import type { AIState, Orders, Teams } from "./enums";
import { Reader, Writer } from "./enet";
import { replacer } from "./utils";

export enum ENetChannels {
    DEFAULT = 0,
    GENERIC_APP_TO_SERVER = 1,
    SYNCHCLOCK = 2,
    GENERIC_APP_BROADCAST = 3,
    GENERIC_APP_BROADCAST_UNRELIABLE = 4,
    MIDDLE_TIER_CHAT = 5,
    MIDDLE_TIER_ROSTER = 6,
}

export enum Type {
    Dummy,
    SPM_HierarchicalProfilerUpdate,
    S2C_DisplayLocalizedTutorialChatText,
    Barrack_SpawnUnit,
    S2C_SwitchNexusesToOnIdleParticles,
    C2S_TutorialAudioEventFinished,
    S2C_SetCircularMovementRestriction,
    UpdateGoldRedirectTarget,
    SynchSimTimeC2S,
    RemoveItemReq,
    ResumePacket,
    RemoveItemAns,
    pkt32,
    Basic_Attack,
    S2C_RefreshObjectiveText,
    S2C_CloseShop,
    S2C_Reconnect,
    UnitAddEXP,
    S2C_EndSpawn,
    SetFrequency,
    S2C_HighlightTitanBarElement,
    S2C_BotAI,
    S2C_TeamSurrenderCountDown,
    C2S_QueryStatusReq,
    NPC_UpgradeSpellAns,
    C2S_Ping_Load_Info,
    ChangeSlotSpellType,
    NPC_MessageToClient,
    DisplayFloatingText,
    Basic_Attack_Pos,
    NPC_ForceDead,
    NPC_BuffUpdateCount,
    C2S_WriteNavFlags_Acc,
    NPC_BuffReplaceGroup,
    NPC_SetAutocast,
    SwapItemReq,
    NPC_Die_EventHistroy,
    UnitAddGold,
    AddUnitPerceptionBubble,
    S2C_MoveCameraToPoint,
    S2C_LineMissileHitList,
    S2C_MuteVolumeCategory,
    ServerTick,
    S2C_StopAnimation,
    AvatarInfo_Server,
    DampenerSwitch,
    World_SendCamera_Server_Acknologment,
    S2C_ModifyDebugCircleRadius,
    World_SendCamera_Server,
    HeroReincarnateAlive,
    NPC_BuffReplace,
    Pause,
    SetFadeOut_Pop,
    ChangeSlotSpellName,
    ChangeSlotSpellIcon,
    ChangeSlotSpellOffsetTarget,
    RemovePerceptionBubble,
    NPC_InstantStop_Attack,
    OnLeaveLocalVisiblityClient,
    S2C_ShowObjectiveText,
    CHAR_SpawnPet,
    FX_Kill,
    NPC_UpgradeSpellReq,
    UseObjectC2S,
    Turret_CreateTurret,
    MissileReplication,
    ResetForSlowLoader,
    S2C_HighlightHUDElement,
    SwapItemAns,
    NPC_LevelUp,
    S2C_MapPing,
    S2C_WriteNavFlags,
    S2C_PlayEmote,
    S2C_Reconnect_Done,
    S2C_OnEventWorld,
    S2C_HeroStats,
    C2S_PlayEmote,
    HeroReincarnate,
    C2S_OnScoreBoardOpened,
    S2C_CreateHero,
    SPM_AddMemoryListener,
    SPM_HierarchicalMemoryUpdate,
    S2C_ToggleUIHighlight,
    S2C_FaceDirection,
    OnLeaveVisiblityClient,
    C2S_ClientReady,
    SetItem,
    SynchVersionS2C,
    S2C_HandleTipUpdate,
    C2S_StatsUpdateReq,
    C2S_MapPing,
    S2C_RemoveDebugCircle,
    S2C_CreateUnitHighlight,
    S2C_DestroyClientMissile,
    S2C_LevelUpSpell,
    S2C_StartGame,
    C2S_OnShopOpened,
    NPC_Hero_Die,
    S2C_FadeOutMainSFX,
    UserMessagesStart,
    WaypointGroup,
    S2C_StartSpawn,
    S2C_CreateNeutral,
    WaypointGroupWithSpeed,
    UnitApplyDamage,
    ModifyShield,
    S2C_PopCharacterData,
    NPC_BuffAddGroup,
    S2C_AI_TargetSelection,
    AI_TargetS2C,
    S2C_SetAnimStates,
    S2C_ChainMissileSync,
    C2S_OnTipEvent,
    MissileReplication_ChainMissile,
    BuyItemAns,
    S2C_SetSpellData,
    S2C_PauseAnimation,
    NPC_IssueOrderReq,
    S2C_CameraBehavior,
    S2C_AnimatedBuildingSetCurrentSkin,
    Connected,
    SyncSimTimeFinalS2C,
    Waypoint_Acc,
    AddPosPerceptionBubble,
    S2C_LockCamera,
    S2C_PlayVOAudioEvent,
    AI_Command,
    NPC_BuffRemove2,
    SpawnMinionS2C,
    ClientCheatDetectionSignal,
    S2C_ToggleFoW,
    S2C_ToolTipVars,
    UnitApplyHeal,
    GlobalCombatMessage,
    World_LockCamera_Server,
    BuyItemReq,
    WaypointListHeroWithSpeed,
    S2C_SetInputLockingFlag,
    CHAR_SetCooldown,
    CHAR_CancelTargetingReticle,
    FX_Create_Group,
    S2C_QueryStatusAns,
    Building_Die,
    SPM_RemoveListener,
    S2C_HandleQuestUpdate,
    C2S_ClientFinished,
    CHAT,
    SPM_RemoveMemoryListener,
    C2S_Exit,
    ServerGameSettings,
    S2C_ModifyDebugCircleColor,
    SPM_AddListener,
    World_SendGameNumber,
    ChangePARColorOverride,
    C2S_ClientConnect_NamedPipe,
    NPC_BuffRemoveGroup,
    Turret_Fire,
    S2C_Ping_Load_Info,
    S2C_ChangeCharacterVoice,
    S2C_ChangeCharacterData,
    S2C_Exit,
    SPM_RemoveBBProfileListener,
    NPC_CastSpellReq,
    S2C_ToggleInputLockingFlag,
    C2S_Reconnect,
    S2C_CreateTurret,
    NPC_Die,
    UseItemAns,
    S2C_ShowAuxiliaryText,
    PausePacket,
    S2C_HideObjectiveText,
    OnEvent,
    C2S_TeamSurrenderVote,
    S2C_TeamSurrenderStatus,
    SPM_AddBBProfileListener,
    S2C_HideAuxiliaryText,
    OnReplication_Acc,
    OnDisconnected,
    S2C_SetGreyscaleEnabledWhenDead,
    S2C_AI_State,
    S2C_SetFoWStatus,
    // ReloadScripts,
    // Cheat,
    OnEnterLocalVisiblityClient,
    S2C_HighlightShopElement,
    SendSelectedObjID,
    S2C_PlayAnimation,
    S2C_RefreshAuxiliaryText,
    SetFadeOut_Push,
    S2C_OpenTutorialPopup,
    S2C_RemoveUnitHighlight,
    NPC_CastSpellAns,
    SPM_HierarchicalBBProfileUpdate,
    NPC_BuffAdd2,
    S2C_OpenAFKWarningMessage,
    WaypointList,
    OnEnterVisiblityClient,
    S2C_AddDebugCircle,
    S2C_DisableHUDForEndOfGame,
    SynchVersionC2S,
    C2S_CharSelected,
    NPC_BuffUpdateCountGroup,
    AI_TargetHeroS2C,
    SynchSimTimeS2C,
    SyncMissionStartTimeS2C,
    S2C_Neutral_Camp_Empty,
    OnReplication,
    S2C_EndOfGameEvent,
    S2C_EndGame,
    Undefined,
    SPM_SamplingProfilerUpdate,
    S2C_PopAllCharacterData,
    S2C_TeamSurrenderVote,
    S2C_HandleUIHighlight,
    S2C_FadeMinions,
    C2S_OnTutorialPopupClosed,
    C2S_OnQuestEvent,
    S2C_ShowHealthBar,
    SpawnBotS2C,
    SpawnLevelPropS2C,
    UpdateLevelPropS2C,
    AttachFlexParticleS2C,
    S2C_HandleCapturePointUpdate,
    S2C_HandleGameScore,
    S2C_HandleRespawnPointUpdate,
    C2S_OnRespawnPointEvent,
    S2C_UnitChangeTeam,
    S2C_UnitSetMinimapIcon,
    S2C_IncrementPlayerScore,
    S2C_IncrementPlayerStat,
    S2C_ColorRemapFX,
    S2C_MusicCueCommand,
    S2C_AntiBot,
    S2C_AntiBotWriteLog,
    S2C_AntiBotKickOut,
    S2C_AntiBotBanPlayer,
    S2C_AntiBotTrojan,
    S2C_AntiBotCloseClient,
    C2S_AntiBotDP,
    C2S_AntiBot,
    S2C_OnEnterTeamVisiblity,
    S2C_OnLeaveTeamVisiblity,
    S2C_FX_OnEnterTeamVisiblity,
    S2C_FX_OnLeaveTeamVisiblity,
    ReplayOnly_GoldEarned,
    Batched,
}

export enum PayloadType {
    RequestJoinTeam = 100,
    RequestReskin = 101,
    RequestRename = 102,
    TeamRosterUpdate = 103,
    Chat = 104,
    sendToServer = 105,
    broadcastToClients = 106
}

export enum NetNodeID {
    Spawned = 0x40,
    Map = 0xFF,
}

const buffer = Buffer.alloc(10 * 1460)

export abstract class BasePacket {

    //public _size(): number {
    //    throw new Error("Method not implemented.");
    //}
    public _read(reader: Reader): void {
        throw new Error("Method not implemented.");
    }
    public _write(writer: Writer): void {
        throw new Error("Method not implemented.");
    }

    public read(bufferOrReader: Buffer | Reader): this {
    
        //if(!(this instanceof World_SendCamera_Server)){
        //    console.log('read', this.constructor.name)
        //    if(Buffer.isBuffer(bufferOrReader))
        //        console.log('source', bufferOrReader.toHex())
        //}

        const reader =
            bufferOrReader instanceof Reader ?
                bufferOrReader :
                new Reader(bufferOrReader, 'LE')
        
        reverseCall(this, this._read.name, reader)

        //if(!(this instanceof World_SendCamera_Server)){
        //    console.log('result', this.stringify())
        //}
        
        return this
    }

    public write(writer?: Writer): Buffer {

        //if(!(this instanceof World_SendCamera_Server_Acknologment)){
        //    console.log('write', this.constructor.name)
        //    console.log('source', this.stringify())
        //}

        writer ??= new Writer(buffer, 'LE')
        
        reverseCall(this, this._write.name, writer)

        const result = buffer.subarray(0, writer.position)

        //if(!(this instanceof World_SendCamera_Server_Acknologment)){
        //    console.log('result', result.toHex())
        //}
        
        return result
    }

    stringify(){
        return JSON.stringify(this, replacer, 4)
    }

    //constructor(obj?: any){
    //    Object.assign(this, obj)
    //}
}

function reverseCall(obj: any, key: string, ...args: any[]): void {
    const protos = []
    let proto = obj
    while(true){
        proto = Object.getPrototypeOf(proto)
        if(proto == BasePacket.prototype) break
        if(Object.hasOwn(proto, key))
            protos.push(proto)
    }
    protos.reverse()
    for(const proto of protos){
        //console.log('calling', key, 'on', proto)
        proto[key].call(obj, ...args)
    }
}

export abstract class GamePacket extends BasePacket {
    public senderNetID: number = 0
    //public override _size(){ return 5 }
    public override _read(reader: Reader): void {
        const type = reader.readByte("type")
        console.assert(type == this._type(), `Assertion failed: type (${type}) == this._type() (${this._type()})`)
        this.senderNetID = reader.readUInt32("senderNetID")
    }
    public override _write(writer: Writer): void {
        writer.writeByte(this._type())
        writer.writeUInt32(this.senderNetID)
    }
    public _type(): Type {
        throw new Error("Method not implemented.");
    }
}

export abstract class DefaultPayload extends BasePacket {
    //public override _size(){ return 1 + 3 }
    public override _read(reader: Reader): void {
        const type = reader.readByte("type")
        reader.readBytes(3)
        console.assert(type == this._type(), `Assertion failed: type (${type}) == this._type() (${this._type()})`)
    }
    public override _write(writer: Writer): void {
        writer.writeByte(this._type())
        writer.writeByte(0)
        writer.writeByte(0)
        writer.writeByte(0)
    }
    public _type(): PayloadType {
        throw new Error("Method not implemented.");
    }
}

export class RegistryPacket extends BasePacket {

    //uchar action;
    //ulong cid;
    //long64 playerID;
    //uchar signiture[8];

    action: number = 0
    cid: number = 0
    playerID: bigint = 0n
    signiture: Buffer = Buffer.from([])

    //public override _size(){ return 1 + 3 + 4 + 8 + 8 }
    public override _read(reader: Reader): void {
        this.action = reader.readByte("action")
        reader.readBytes(3)
        this.cid = reader.readUInt32("cid")
        this.playerID = reader.readUInt64("playerID")
        this.signiture = reader.readBytes(8)
    }

    public override _write(writer: Writer): void {
        writer.writeByte(this.action)
        writer.writeByte(0)
        writer.writeByte(0)
        writer.writeByte(0)
        writer.writeUInt32(this.cid)
        writer.writeUInt64(this.playerID)
        writer.writeBytes(this.signiture)
    }
}

export class RequestJoinTeam extends DefaultPayload {
    // ulong Id_Player;
    // enum TEAMS team;
    playerID: number = 0
    team: Teams = 0 as Teams
    public override _type(){ return PayloadType.RequestJoinTeam }
    //public override _size(){ return 4 + 4 }
    public override _read(reader: Reader): void {
        this.playerID = reader.readUInt32("playerID")
        this.team = reader.readUInt32("team")
    }
    public override _write(writer: Writer): void {
        writer.writeUInt32(this.playerID)
        writer.writeUInt32(this.team)
    }
}

export class RequestReskin extends DefaultPayload {
    
    // long64 Id_Player;
    // int skinID;
    // ulong bufferLen;
    // char buffer[128];

    playerId: bigint = 0n
    skinID = 0
    buffer: string = ''

    public override _type(){ return PayloadType.RequestReskin }
    //public override _size(){ return 8 + 8 + 4 + 24*8 + 24*8 + 8 + 8 }
    public override _read(reader: Reader): void {
        reader.readUInt32("padding")
        this.playerId = reader.readUInt64("playerId")
        this.skinID = reader.readUInt32("skinID")
        const bufferLen = reader.readUInt32("bufferLen")
        this.buffer = reader.readFixedString(bufferLen)
    }
    public override _write(writer: Writer): void {
        writer.writeUInt32(0)
        writer.writeUInt64(this.playerId)
        writer.writeUInt32(this.skinID)
        const bufferLen = this.buffer.length + 1
        writer.writeUInt32(bufferLen)
        writer.writeFixedString(bufferLen, this.buffer)
        //writer.writeByte(0)
    }
}

export class RequestRename extends RequestReskin {
    public override _type(){ return PayloadType.RequestRename }
}

export class TeamRosterUpdate extends DefaultPayload {

    // ulong teamsize_order;
    // ulong teamsize_chaos;
    // undefined field6_0xc;
    // undefined field7_0xd;
    // undefined field8_0xe;
    // undefined field9_0xf;
    // long64 orderMembers[24];
    // long64 chaosMembers[24];
    // ulong current_teamsize_order;
    // ulong current_teamsize_chaos;

    teamsize_order: number = 0
    teamsize_chaos: number = 0
    orderMembers: bigint[] = []
    chaosMembers: bigint[] = []
    current_teamsize_order: number = 0
    current_teamsize_chaos: number = 0
    
    public override _type(){ return PayloadType.TeamRosterUpdate }
    //public override _size(){ return 4 + 4 + 4 + 24*8 + 24*8 + 4 + 4 }
    public override _read(reader: Reader): void {
        this.teamsize_order = reader.readUInt32("teamsize_order")
        this.teamsize_chaos = reader.readUInt32("teamsize_chaos")
        
        reader.readUInt32("padding")

        for(let i = 0; i < 24; i++)
            this.orderMembers[i] = reader.readUInt64(`orderMembers[${i}]`)
        for(let i = 0; i < 24; i++)
            this.chaosMembers[i] = reader.readUInt64(`chaosMembers[${i}]`)
        
        this.current_teamsize_order = reader.readUInt32("current_teamsize_order")
        this.current_teamsize_chaos = reader.readUInt32("current_teamsize_chaos")
    }
    public override _write(writer: Writer): void {
        writer.writeUInt32(this.teamsize_order)
        writer.writeUInt32(this.teamsize_chaos)

        writer.writeUInt32(0)

        for(let i = 0; i < 24; i++)
            writer.writeUInt64(this.orderMembers[i] ?? 0n)
        for(let i = 0; i < 24; i++)
            writer.writeUInt64(this.chaosMembers[i] ?? 0n)

        writer.writeUInt32(this.current_teamsize_order)
        writer.writeUInt32(this.current_teamsize_chaos)
    }
}

export class ClientCheatDetectionSignal extends GamePacket {

    //uint signal;
    //uint flags;
}
export class RemoveItemReq extends GamePacket {
    //uchar slot:7;
    //uchar sell:1;
}
export class SPM_HierarchicalMemoryUpdate extends GamePacket {
    //struct HierarchicalMemoryUpdateHeader header;
    //struct HierarchicalMemoryUpdateEntry entries[0];
}
export class S2C_CameraBehavior extends GamePacket {
    //struct r3dPoint3D position;
}
export class DisplayFloatingText extends GamePacket {
    //ulong targetNetID;
    //uchar floatingTextType;
    //int param1;
    //char message[128];
}
export class S2C_HandleTipUpdate extends GamePacket {
    //char tipName[128];
    //char tipOther[128];
    //char tipImagePath[128];
    //uchar tipCommand;
    //int tipId;
}
export class World_SendGameNumber extends GamePacket {
    //ulong64 gameID;
    gameID: bigint = 0n
    public override _type(){ return Type.World_SendGameNumber }
    //public override _size(){ return 8 }
    public override _read(reader: Reader): void {
        this.gameID = reader.readUInt64("gameID")
    }
    public override _write(writer: Writer): void {
        writer.writeUInt64(this.gameID)
    }
}
export class S2C_BotAI extends GamePacket {
    //char botAIName[64];
    //char botAIStrategy[64];
    //char botAIBehavior[64];
    //char botAITask[64];
    //char botAIState[3][64];
}
export class S2C_Neutral_Camp_Empty extends GamePacket {
    //uint playerID;
    //int campIndex;
    //bool state;
}
export class NPC_CastSpellReq extends GamePacket {
    //bool isSummonerSpellSlot:1;
    //uchar slot:7;
    //struct r3dPoint3D pos;
    //struct r3dPoint3D endPos;
    //ulong targetNetID;
}
export class AvatarInfo {
    //ulong itemIDs[30];
    //ulong spellHashes[2];
    //struct Talent talentsHashes[80];
    //uchar level;
}
export class NPC_LevelUp extends GamePacket {
    //uchar level;
    //uchar points;
}
export class S2C_OpenTutorialPopup extends GamePacket {
    //char messageboxTextStringID[128];
}
export class GlobalCombatMessage extends GamePacket {
    //enum CombatMessage message;
    //ulong gameObjectNetIdForName;
}
export class ReplayOnly_GoldEarned extends GamePacket {
    //ulong ownerID;
    //float amount;
}
export class C2S_AntiBot extends GamePacket {
    //ushort protoID;
    //ushort pktSize;
    //uchar pktData[1024];
}
export class S2C_CloseShop extends GamePacket {
}
export class S2C_UnitChangeTeam extends GamePacket {
    //ulong targetNetID;
    //int team;
}
export class S2C_Reconnect extends GamePacket {
    //ulong cid;
}
export class S2C_FaceDirection extends GamePacket {
    //struct r3dPoint3D facing;
}
export class NPC_Die_EventHistroy extends GamePacket {
    //ulong killerNetID;
    //float timeWindow;
    //enum EventSourceType killerEventSourceType:4;
    //undefined field8_0xe;
    //undefined field9_0xf;
    //undefined field10_0x10;
}
export class FX_Kill extends GamePacket {
    //ulong netID;
}
export class S2C_TeamSurrenderStatus extends GamePacket {
    //enum Reason reason;
    //uchar forVote;
    //uchar againstVote;
    //int team;
}
export class ChangeSlotSpellIcon extends GamePacket {
    //uchar slot:7;
    //bool isSummonerSpell:1;
    //uchar iconIndex;
}
export class SynchSimTimeS2C extends GamePacket {
    //float synchtime;
    synchtime: number = 0
    public override _type(){ return Type.SynchSimTimeS2C }
    //public override _size(){ return 4 }
    public override _read(reader: Reader){
        this.synchtime = reader.readFloat("synchtime")
    }
    public override _write(writer: Writer){
        writer.writeFloat(this.synchtime)
    }
}
export class NPC_BuffReplace extends GamePacket {
    //uchar buffSlot;
    //float runningTime;
    //float duration;
    //ulong casterNetID;
}
export class S2C_HandleQuestUpdate extends GamePacket {
    //char param[128];
    //char param2[128];
    //char param3[128];
    //uchar questType;
    //uchar questCommand;
    //bool flags:1;
    //int questId;
}
export class NPC_BuffUpdateCount extends GamePacket {
    //uchar buffSlot;
    //uchar count;
    //float duration;
    //float runningTime;
    //ulong casterNetID;
}
export class OnLeaveLocalVisiblityClient extends GamePacket {
}
export class S2C_HighlightHUDElement extends GamePacket {
    //uchar elementType;
    //uchar elementNumber;
}
export class FX_Create_Group extends GamePacket {
    //uchar numbFXGroups;
    //uchar data[0];
}
export class ChangeSlotSpellName extends GamePacket {
    //uchar slot:7;
    //bool isSummonerSpell:1;
    //char spellName[64];
}
export class S2C_DestroyClientMissile extends GamePacket {
}
export class WaypointGroup extends GamePacket {
    
    //undefined field5_0x5;
    //undefined field6_0x6;
    //undefined field7_0x7;
    //undefined field8_0x8;
    //undefined field9_0x9;
    //undefined field10_0xa;
    //uchar data[0];

    syncID: number = 0
    movements: MovementDataNormal[] = []
    public override _type(){ return Type.WaypointGroup }
    public override _read(reader: Reader){
        this.syncID = reader.readUInt32()
        const count = reader.readUInt16()
        for(let i = 0; i < count; i++){
            const mdn = new MovementDataNormal()
                  mdn._read(reader)
            this.movements.push(mdn)
        }
    }
    public override _write(writer: Writer){
        writer.writeUInt32(this.syncID)
        writer.writeUInt16(this.movements.length)
        for(const movement of this.movements){
            movement._write(writer)
        }
    }
}
export class S2C_PlayEmote extends GamePacket {
    //ulong emotId;
}
export class RemovePerceptionBubble extends GamePacket {
    //ulong bubbleID;
}
export class ServerGameSettings extends GamePacket {
    //bool FoW_LocalCulling;
    //bool FoW_BroadcastEverything;
}
export class HeroReincarnateAlive extends GamePacket {
    //struct r3dPoint3D location;
}
export class UseObjectC2S extends GamePacket {
    //ulong targetNetID;
}
export class S2C_ShowAuxiliaryText extends GamePacket {
    //char textStringID[128];
}
export class S2C_SetInputLockingFlag extends GamePacket {
    //uint inputLockingFlags;
    //bool flagValue;
}
export class C2S_TutorialAudioEventFinished extends GamePacket {
    //ulong audioEventNetworkID;
}
export class SPM_SamplingProfilerUpdate extends GamePacket {
    //uint entryCount;
    //uint sizeOfStringBlock;
}
export class ModifyShield extends GamePacket {
    //bool toPhysicalShield:1;
    //bool toMagicShield:1;
    //bool noFade:1;
    //float amount;
}
export class UseItemAns extends GamePacket {
    //uchar slot;
    //uchar itemsInSlot;
    //uchar spellCharges;
}
export class UpdateGoldRedirectTarget extends GamePacket {
    //ulong goldRedirectTargetNetID;
}
export class NPC_BuffRemove2 extends GamePacket {
    //uchar buffSlot;
    //uint buffNameHash;
}
export class SPM_RemoveListener extends GamePacket {
}
export class C2S_TeamSurrenderVote extends GamePacket {
    //bool vote:1;
}
export class S2C_StartSpawn extends GamePacket {
    //uchar numbBotsOrder;
    //uchar numbBotsChaos;

    numBotsOrder: number = 0
    numBotsChaos: number = 0

    public override _type(){ return Type.S2C_StartSpawn }
    //public override _size(){ return 2 + 2 }
    public override _read(reader: Reader){
        this.numBotsOrder = reader.readUInt16("numBotsOrder")
        this.numBotsChaos = reader.readUInt16("numBotsChaos")
    }
    public override _write(writer: Writer){
        writer.writeUInt16(this.numBotsOrder)
        writer.writeUInt16(this.numBotsChaos)
    }
}
export class S2C_EndSpawn extends GamePacket {
    public override _type(){ return Type.S2C_EndSpawn }
    //public override _size(){ return 0 }
    public override _read(){}
    public override _write(){}
}
export class NPC_BuffUpdateCountGroup extends GamePacket {
    //float duration;
    //float runningTime;
    //uchar numInGroup;
}
export class ReloadScripts extends GamePacket {
}
export class C2S_Exit extends GamePacket {
}
export class S2C_ToggleUIHighlight extends GamePacket {
    //uchar elementID;
    //uchar elementType;
    //uchar elementNumber;
    //uchar elementSubCategory;
    //bool flag:1;
}
export class CHAR_SetCooldown_Broadcast extends GamePacket {
    //uchar slot:7;
    //bool isSummonerSpell:1;
    //float cooldown;
}
export class NPC_CastSpellAns extends GamePacket {
    //int casterPosSyncID;
}
export class S2C_MusicCueCommand extends GamePacket {
    //uchar musicCueCommand;
    //uint cueID;
}
export class S2C_EndOfGameEvent extends GamePacket {
    //uchar teamIsOrder;
}
export class S2C_RemoveUnitHighlight extends GamePacket {
    //ulong unitNetworkID;
}
export class UnitApplyDamage extends GamePacket {
    //uchar type:7;
    //bool hasAttackSound:1;
    //ulong targetNetID;
    //ulong sourceNetID;
    //float damage;
}
export class S2C_ChangeCharacterData extends GamePacket {
    //ulong id;
    //bool useSpells;
    //char skinName[64];
}
export class ChangeSlotSpellType extends GamePacket {
    //uchar slot:7;
    //bool isSummonerSpell:1;
    //uchar targeting;
}
export class S2C_OnLeaveTeamVisiblity extends GamePacket {
    //uchar team;
}
export class SpawnBotS2C extends GamePacket {
    //ulong netObjID;
    //uchar netNodeID;
    //struct r3dPoint3D pos;
    //uchar botRank;
    //uint teamID:9;
    //undefined field10_0x19;
    //undefined field11_0x1a;
    //int skinID;
    //char name[64];
    //char skinName[64];
}
export class S2C_FX_OnLeaveTeamVisiblity extends GamePacket {
    //ulong netID;
    //uchar team;
}
export class S2C_DisplayLocalizedTutorialChatText extends GamePacket {
    //char stringID[128];
}
export class S2C_ChainMissileSync extends GamePacket {
    //int size;
    //ulong ownerNetworkID;
    //ulong targets[32];
}
export class OnReplication_Acc extends GamePacket {
    //uint syncID;
}
export class S2C_SetCircularMovementRestriction extends GamePacket {
    //struct r3dPoint3D center;
    //float radius;
    //bool restrictCamera;
}
export class C2S_MapPing extends GamePacket {
    //struct r3dPoint3D pos;
    //ulong target;
    //uchar pingCategoty:4;
}
export class ChangePARColorOverride extends GamePacket {
    //ulong unitID;
    //char mbEnabling;
    //struct r3dColor barColor;
    //struct r3dColor fadeColor;
}
export class UnitAddEXP extends GamePacket {
    //ulong targetNetID;
    //float exp;
}
export class SPM_HierarchicalBBProfileUpdate extends GamePacket {
    //struct HierarchicalBBProfileUpdateHeader header;
    //uchar entries[0];
}
export class S2C_QueryStatusAns extends GamePacket {
    //uchar res;
    res: boolean = false
    public override _type(){ return Type.S2C_QueryStatusAns }
    //public override _size(){ return 1 }
    public override _write(writer: Writer): void {
        writer.writeBool(this.res)
    }
    public override _read(reader: Reader): void {
        this.res = reader.readBool("res")
    }
}
export class S2C_IncrementPlayerScore extends GamePacket {
    //ulong playerNetworkID;
    //uchar scoreCategory;
    //uchar scoreEvent;
    //bool shouldCallout:1;
    //float pointValue;
    //float totalPointValue;
}
export class S2C_ModifyDebugCircleColor extends GamePacket {
    //int id;
    //struct r3dColor color;
}
export class OnLeaveVisiblityClient extends GamePacket {
}
export class CHAR_SetCooldown extends GamePacket {
    //uchar slot:7;
    //bool isSummonerSpell:1;
    //float cooldown;
}
export class BuyItemReq extends GamePacket {
    //ulong itemID;
}
export class NPC_BuffReplaceGroup extends GamePacket {
    //float runningTime;
    //float duration;
    //uchar numInGroup;
}
export class S2C_HandleRespawnPointUpdate extends GamePacket {
    //uchar respawnPointCommand;
    //uchar respawnPointUIID;
    //int team;
    //ulong clientID;
    //struct r3dPoint3D pos;
}
export class NPC_Die extends GamePacket {
    //undefined field5_0x5;
    //undefined field6_0x6;
    //undefined field7_0x7;
    //undefined field8_0x8;
    //undefined field9_0x9;
    //undefined field10_0xa;
    //undefined field11_0xb;
    //undefined field12_0xc;
    //undefined field13_0xd;
    //undefined field14_0xe;
    //undefined field15_0xf;
}
export class NPC_Hero_Die extends GamePacket {
    //undefined field5_0x5;
    //undefined field6_0x6;
    //undefined field7_0x7;
    //undefined field8_0x8;
    //undefined field9_0x9;
    //undefined field10_0xa;
    //undefined field11_0xb;
    //undefined field12_0xc;
    //undefined field13_0xd;
    //undefined field14_0xe;
    //undefined field15_0xf;
}
export class SetFadeOut_Pop extends GamePacket {
    //short id;
}
export class S2C_MoveCameraToPoint extends GamePacket {
    //bool startAtCurrentCameraPosition:1;
    //struct r3dPoint3D startPosition;
    //struct r3dPoint3D targetPosition;
    //float travelTime;
}
export class SynchSimTimeC2S extends GamePacket {
    //ulong clientNetID;
    //float time_LastServer;
    //float time_LastClient;
    //uchar checkSum[32];
}
export class S2C_CreateTurret extends GamePacket {
    //ulong netObjID;
    //uchar netNodeID;
    //char name[64];
}
export class OnReplicationMixin extends GamePacket {
    //uint syncID;
    //uchar count;
}
export class SPM_RemoveBBProfileListener extends GamePacket {
}
export class S2C_CreateNeutral extends GamePacket {
    //ulong netObjID;
    //uchar netNodeID;
    //struct r3dPoint3D pos;
    //struct r3dPoint3D groupPos;
    //struct r3dPoint3D facePos;
    //char name[64];
    //char skinName[64];
    //char uniqueName[64];
    //char minimapIcon[64];
    //int team;
    //int damageBonus;
    //int healthBonus;
    //int roamState;
    //int groupNumber;
    //bool behaviorTree:1;
}
export class S2C_SetGreyscaleEnabledWhenDead extends GamePacket {
    //bool flag:1;
}
export class AttachFlexParticleS2C extends GamePacket {
    //ulong netObjID;
    //uchar flexID;
    //uchar cpIndex;
    //uchar attachType;
}
export class ChangeSlotSpellOffsetTarget extends GamePacket {
    //uchar slot:7;
    //bool isSummonerSpell:1;
    //ulong targetNetID;
}

enum MovementDataType {
    None = 0,
    WithSpeed = 1,
    Normal = 2,
    Stop = 3,
}
export abstract class MovementData extends BasePacket {
    syncID: number = 0
    public abstract _type(): MovementDataType
    public override _read(reader: Reader){
        const type = reader.readByte("type")
        console.assert(type == this._type(), `Assertion failed: type (${type}) == this._type() (${this._type()})`)
        this.syncID = reader.readUInt32("syncID")
    }
    public override _write(writer: Writer){
        writer.writeByte(this._type())
        writer.writeUInt32(this.syncID)
    }
}
export class MovementDataNone extends MovementData {
    public override _type(){ return MovementDataType.None }
    public override _read(){}
    public override _write(){}
}
export class MovementDataNormal extends MovementData {
    teleportNetID: number = 0
    hasTeleportID: boolean = false
    teleportID: number = 0
    waypoints: Vector2[] = []
    public override _type(){ return MovementDataType.Normal }
    public override _read(reader: Reader){
        this.hasTeleportID = (reader.readUInt16("flags") & 1) != 0
        let size = reader.readUInt16("size")
        if(size > 0){
            this.teleportNetID = reader.readUInt32("teleportNetID")
            if(this.hasTeleportID)
                this.teleportID = reader.readByte("teleportID")

            //TODO: Compressed waypoints
            const flags = size > 1 ?
                reader.readBytes(Math.floor((size - 2) / 4 + 1), "flags") :
                undefined!

            let lastX = reader.readInt16("lastX")
            let lastZ = reader.readInt16("lastZ")
            this.waypoints.push(vec2(lastX, lastZ))
            
            for(let i = 1, flag = 0; i < size; i++){
                if(getBitFlagLE(flags, flag++)){
                    lastX += reader.readSByte("lastX offset")
                } else {
                    lastX = reader.readInt16("lastX")
                }
                if(getBitFlagLE(flags, flag++)){
                    lastZ += reader.readSByte("lastZ offset")
                } else {
                    lastZ = reader.readInt16("lastZ")
                }
                this.waypoints.push(vec2(lastX, lastZ))
            }
        }
    }
    public override _write(writer: Writer){
        console.assert(this.waypoints.length <= 0x7F, `Assertion failed: this.waypoints.length (${this.waypoints.length}) <= 0x7F`)
        writer.writeUInt16(+this.hasTeleportID)
        writer.writeUInt16(this.waypoints.length)
        if(this.waypoints.length){
            writer.writeUInt32(this.teleportNetID)
            if(this.hasTeleportID)
                writer.writeByte(this.teleportID)

            //TODO: Compressed waypoints

            const size = this.waypoints.length
            const count = Math.floor((size - 2) / 4 + 1)
            writer.writePad(count)
            for(const waypoint of this.waypoints){
                writer.writeInt16(getX(waypoint))
                writer.writeInt16(getZ(waypoint))
            }
        }
    }
}
export class MovementDataStop extends MovementData {
    position: Vector2 = Vector2.Zero
    forward: Vector2 = Vector2.Zero
    public override _type(){ return MovementDataType.Stop }
    public override _write(writer: Writer){
        Vector2.write(writer, this.position)
        Vector2.write(writer, this.forward)
    }
}
export namespace MovementData {
    export const None = new MovementDataNone()
}

export enum LookAtType {
    None = 0,
    Position = 1,
}

export class OnEnterVisiblityClient extends GamePacket {

    items: {
        slot: number
        itemsInSlot: number
        spellCharges: number
        itemID: number
    }[] = []
    lookAtType: LookAtType = 0
    lookAtPosition: Vector3 = Vector3.Zero
    movementData: MovementData = MovementData.None

    public override _type(){ return Type.OnEnterVisiblityClient }
    public override _write(writer: Writer): void {
        console.assert(this.items.length <= 0xFF, `Assertion failed: this.items.length (${this.items.length}) <= 0xFF`)
        writer.writeByte(this.items.length)
        for(const item of this.items){
            writer.writeByte(item.slot)
            writer.writeByte(item.itemsInSlot)
            writer.writeByte(item.spellCharges)
            writer.writeUInt32(item.itemID)
        }
        writer.writeByte(this.lookAtType)
        if (this.lookAtType != 0)
            Vector3.write(writer, this.lookAtPosition)
        this.movementData.write(writer)
    }
}
export class S2C_ChangeCharacterVoice extends GamePacket {
    //bool reset;
    //char voiceOverride[64];
}
export class S2C_SetSpellData extends GamePacket {
    //ulong netObjID;
    //ulong hashedSpellName;
    //uchar spellSlot;
}
export class S2C_FadeMinions extends GamePacket {
    //uchar team;
    //float fadeAmount;
    //float fadeTime;
}
export class SPM_AddBBProfileListener extends GamePacket {
}
export class SetFadeOut_Push extends GamePacket {
    //short id;
    //float fadeTime;
    //float fadeTargetValue;
}
export class S2C_UnitSetMinimapIcon extends GamePacket {
    //ulong targetNetID;
    //char iconName[64];
}
export class SPM_AddListener extends GamePacket {
}
export class S2C_PlayAnimation extends GamePacket {
    //ulong flags;
    //float scaleTime;
    //char animationName[64];
}
export class S2C_RefreshAuxiliaryText extends GamePacket {
    //char textStringID[128];
}
export class S2C_AddDebugCircle extends GamePacket {
    //int id;
    //ulong unitNetworkID;
    //struct r3dPoint3D center;
    //float radius;
    //struct r3dColor color;
}
export class S2C_AI_TargetSelection extends GamePacket {
    //ulong targetIDs[5];
}
export class S2C_WriteNavFlags extends GamePacket {
    //ushort size;
    //int syncID;
    //uchar data[0];
}
export class C2S_Reconnect extends GamePacket {
    //bool isFullReconnect;
    isFullReconnect: boolean = false
    public override _type(){ return Type.C2S_Reconnect }
    //public override _size(){ return 1 }
    public override _read(reader: Reader): void {
        this.isFullReconnect = reader.readBool("isFullReconnect")
    }
    public override _write(writer: Writer): void {
        writer.writeBool(this.isFullReconnect)
    }
}
export class S2C_SetFoWStatus extends GamePacket {
    //bool enabled;
}
export class HeroReincarnate extends GamePacket {
    //struct r3dPoint3D location;
}
export class NPC_MessageToClient extends GamePacket {
    //ulong targetNetID;
    //float bubbleDelay;
    //int slotNum;
    //uchar isError;
    //uchar colorIndex;
    //char message[1024];
}
export class S2C_MuteVolumeCategory extends GamePacket {
    //uchar volumeCategory;
    //bool muteFlag:1;
}
export class S2C_StopAnimation extends GamePacket {
    //uchar flags;
}
export class PausePacket extends GamePacket {
    //ulong clientID;
    //int pauseTimeRemaining;
    //bool tournamentPause:1;
}
export class S2C_OnEnterTeamVisiblity extends GamePacket {
    //uchar team;
}
export class S2C_OpenAFKWarningMessage extends GamePacket {
}
export class SwapItemAns extends GamePacket {
    //uchar source;
    //uchar dest;
}
export class S2C_FadeOutMainSFX extends GamePacket {
    //float fadeTime;
}
export class S2C_AnimatedBuildingSetCurrentSkin extends GamePacket {
    //uchar team;
    //uint skinID;
}
export class WaypointGroupWithSpeed extends GamePacket {
    //undefined field5_0x5;
    //undefined field6_0x6;
    //undefined field7_0x7;
    //undefined field8_0x8;
    //undefined field9_0x9;
    //undefined field10_0xa;
    //uchar data[0];
}
export class NPC_SetAutocast extends GamePacket {
    //schar slot;
}
export class NPC_InstantStop_Attack extends GamePacket {
    
    public override _type(){ return Type.NPC_InstantStop_Attack }
    
    public keepAnimating: boolean = false
    public forceSpellCast: boolean = false
    public forceStop: boolean = false
    public avatarSpell: boolean = false
    public destroyMissile: boolean = false

    public override _read(reader: Reader): void {
        const bitfield = reader.readByte()
        this.keepAnimating = (bitfield & 0x01) != 0
        this.forceSpellCast = (bitfield & 0x02) != 0
        this.forceStop = (bitfield & 0x04) != 0
        this.avatarSpell = (bitfield & 0x08) != 0
        this.destroyMissile = (bitfield & 0x10) != 0
    }
    public override _write(writer: Writer): void {
        let bitfield = 0
        if(this.keepAnimating) bitfield |= 0x01
        if(this.forceSpellCast) bitfield |= 0x02
        if(this.forceStop) bitfield |= 0x04
        if(this.avatarSpell) bitfield |= 0x08
        if(this.destroyMissile) bitfield |= 0x10
        writer.writeByte(bitfield)
    }
}
export class C2S_OnRespawnPointEvent extends GamePacket {
    //uchar respawnPointEvent;
    //uchar respawnPointUIElementID;
}
export class S2C_HighlightTitanBarElement extends GamePacket {
    //uchar elementType;
}
export class OnEnterLocalVisiblityClient extends GamePacket {
}
export class S2C_TeamSurrenderVote extends GamePacket {
    //bool vote:1;
    //bool firstVote:1;
    //ulong playerNetworkID;
    //uchar forVote;
    //uchar againstVote;
    //uchar numPlayers;
    //int team;
    //float timeOut;
}
export class S2C_SetAnimStates extends GamePacket {
    //uchar numb;
    //uchar entries[0];
}
export class S2C_LockCamera extends GamePacket {
    //bool lock;
}
export class S2C_MapPing extends GamePacket {
    //struct r3dPoint3D pos;
    //ulong target;
    //ulong src;
    //uchar pingCategory:4;
    //bool playAudio:1;
    //bool showChat:1;
    //bool pingThrottled:1;
}
export class NPC_BuffAddGroup extends GamePacket {
    //uchar buffType;
    //uint buffNameHash;
    //float runningTime;
    //float duration;
    //uchar numInGroup;
}
export class S2C_LevelUpSpell extends GamePacket {
    //int spellSlot;
}
export class CHAR_SpawnPet extends GamePacket {
    //ulong netObjID;
    //uchar netNodeID;
    //struct r3dPoint3D pos;
    //int castSpellLevelPlusOne;
    //float duration;
    //int damageBonus;
    //int healthBonus;
    //char name[32];
    //char skin[32];
    //int skinID;
    //char buffName[64];
    //ulong cloneID;
    //bool copyInventory:1;
    //bool clearFocusTarget:1;
    //char aiscript[32];
    //bool showMinimapIcon;
}
export class S2C_EndGame extends GamePacket {
    //bool teamIsOrder:1;
    //bool surrender:1;
}
export class NPC_UpgradeSpellReq extends GamePacket {
    //uchar slot;
}
export class SPM_AddMemoryListener extends GamePacket {
}
export class S2C_ModifyDebugCircleRadius extends GamePacket {
    //int id;
    //float radius;
}
export class NPC_BuffAdd2 extends GamePacket {
    //uchar buffSlot;
    //uchar buffType;
    //uchar count;
    //uchar isHidden;
    //uint buffNameHash;
    //float runningTime;
    //float duration;
    //ulong casterNetID;
}
export class S2C_StartGame extends GamePacket {
    //bool tournamentPauseEnabled:1;
    tournamentPauseEnabled: boolean = false
    public override _type(){ return Type.S2C_StartGame }
    //public override _size(){ return 1 }
    public override _read(reader: Reader){
        this.tournamentPauseEnabled = reader.readBool("tournamentPauseEnabled")
    }
    public override _write(writer: Writer){
        writer.writeBool(this.tournamentPauseEnabled)
    }
}
export class S2C_ShowObjectiveText extends GamePacket {
    //char textStringID[128];
}
export class S2C_HandleCapturePointUpdate extends GamePacket {
    //uchar pointIndex;
    //ulong otherNetworkId;
    //uchar parType;
    //int attackTeam;
    //uchar command;
}
export class C2S_WriteNavFlags_Acc extends GamePacket {
    //int syncID;
}
export class S2C_PopAllCharacterData extends GamePacket {
}
export class Building_Die extends GamePacket {
    //ulong attacker;
}
export class AvatarInfo_Server extends GamePacket {
    //struct AvatarInfo info;
}
export class S2C_IncrementPlayerStat extends GamePacket {
    //ulong playerNetworkID;
    //uchar statEvent;
}
export class SendSelectedObjID extends GamePacket {
    //ulong clientID;
    //ulong selectedNetworkID;
}
export class FX_Common {
    //ulong effNameHash;
    //ushort flags;
    //ulong targetBoneName;
    //ulong boneName;
    //uchar count;
}
export class S2C_LineMissileHitList extends GamePacket {
    //short size;
}
export class UpdateLevelPropS2C extends GamePacket {
    //char stringParam1[64];
    //float floatParam1;
    //float floatParam2;
    //ulong netObjID;
    //ulong flags1;
    //uchar command;
    //uchar byteParam1;
    //uchar byteParam2;
    //uchar byteParam3;
}
export class S2C_AI_State extends GamePacket {
    //int stateID;
    stateID: AIState = 0
    public override _type(){ return Type.S2C_AI_State }
    public override _read(reader: Reader){
        this.stateID = reader.readUInt32("stateID")
    }
    public override _write(writer: Writer){
        writer.writeUInt32(this.stateID)
    }
}
export class SetItem extends GamePacket {
    //uchar slot;
    //ulong itemID;
    //uchar itemsInSlot;
    //uchar spellCharges;
}
export class Waypoint_Acc extends GamePacket {
    //int syncID;
    //uchar teleportCount;
}
export class MissileReplication extends GamePacket {
    //struct r3dPoint3D position;
    //struct r3dPoint3D casterPos;
    //struct r3dPoint3D direction;
    //struct r3dPoint3D velocity;
    //struct r3dPoint3D startPoint;
    //struct r3dPoint3D endPoint;
    //struct r3dPoint3D unitPos;
    //float speed;
    //float lifePercentage;
    //bool bounced;
    //char castInfoBuf[512];
}
export class SPM_HierarchicalProfilerUpdate extends GamePacket {
    //uint frameNum;
    //uint entryCount;
    //struct HierarchicalProfilerUpdateEntry entries[0];
}
export class AddUnitPerceptionBubble extends GamePacket {
    //int perceptionBubbleType;
    //ulong clientNetID;
    //float radius;
    //ulong unitNetID;
    //float timeToLive;
    //ulong bubbleID;
    //ulong flags;
}
export class AI_TargetHeroS2C extends GamePacket {
    //ulong targetID;
}
export class S2C_ToolTipVars extends GamePacket {
    //ushort size;
    //uchar data[0];
}
export class S2C_HandleUIHighlight extends GamePacket {
    //uchar uiHighlightCommand;
    //uchar uiElement;
}
export class NPC_UpgradeSpellAns extends GamePacket {
    //uchar slot;
    //uchar spellLevel;
    //uchar spellTrainingPoints;
}
export class S2C_PauseAnimation extends GamePacket {
    //bool state;
}
export class C2S_AntiBotDP extends GamePacket {
    //ushort protoID;
    //ushort pktSize;
    //uchar pktData[1024];
}
export class S2C_CreateHero extends GamePacket {
    //ulong netObjID;
    //ulong playerUID;
    //uchar netNodeID;
    //uchar skillLevel;
    //uchar teamIsOrder;
    //uchar isBot;
    //uchar botRank;
    //uchar spawnPosIndex;
    //int skinID;
    //char name[40];
    //char skin[40];

    netObjID: number = 0
    playerUID: number = 0
    netNodeID: number = 0
    skillLevel: number = 0
    teamIsOrder: boolean = false
    isBot: boolean = false
    botRank: number = 0
    spawnPosIndex: number = 0
    skinID: number = 0
    name: string = ''
    skin: string = ''

    public override _type(){ return Type.S2C_CreateHero }
    //public override _size(){ return 8 + 8 + 6*1 + 4 + 40 + 40 }
    public override _read(reader: Reader){
        throw new Error("Method not implemented.");
    }
    public override _write(writer: Writer){
        writer.writeUInt32(this.netObjID)
        writer.writeUInt32(this.playerUID)
        writer.writeByte(this.netNodeID)
        writer.writeByte(this.skillLevel)
        writer.writeBool(this.teamIsOrder)
        writer.writeBool(this.isBot)
        writer.writeByte(this.botRank)
        writer.writeByte(this.spawnPosIndex)
        writer.writeUInt32(this.skinID)
        writer.writeFixedString(40, this.name)
        writer.writeFixedString(40, this.skin)
    }
}
export class SyncSimTimeFinalS2C extends GamePacket {
    //float time_LastClient;
    //float time_RTTlastoverhead;
    //float time_convergence;
}
export class S2C_CreateUnitHighlight extends GamePacket {
    //ulong unitNetworkID;
}
export class C2S_OnTutorialPopupClosed extends GamePacket {
}
export class SpawnMinionS2C extends GamePacket {
    //ulong netObjID;
    //uchar netNodeID;
    //struct r3dPoint3D pos;
    //int skinID;
    //ulong cloneID;
    //uint teamID:9;
    //undefined field11_0x20;
    //undefined field12_0x21;
    //float visibilitySize;
    //bool ignoreCollision:1;
    //bool isWard:1;
    //bool useBehaviorTreeAI:1;
    //char name[64];
    //char skinName[64];
}
export class RemoveItemAns extends GamePacket {
    //uchar slot;
    //uchar itemsInSlot;
}
export class S2C_TeamSurrenderCountDown extends GamePacket {
    //float timeRemaining;
}
export class AI_Command extends GamePacket {
    //char command[128];
}
export class WaypointListWithSpeed extends GamePacket {
    //int syncID;
    //struct SpeedParams speedParams;
    //struct NetWaypoint dataarray_NWP[0];
}
export class S2C_HighlightShopElement extends GamePacket {
    //uchar elementType;
    //uchar elementNumber;
    //uchar elementSubCategory;
}
export class SPM_RemoveMemoryListener extends GamePacket {
}
export class S2C_HeroStats extends GamePacket {
}
export class S2C_RemoveDebugCircle extends GamePacket {
    //int id;
}
export class SetFrequency extends GamePacket {
    //float newFrequency;
}
export class S2C_ToggleInputLockingFlag extends GamePacket {
    //uint inputLockingFlags;
}

export class NPC_IssueOrderReq extends GamePacket {
    //struct OrderInfo info;
    //struct OrderInfo {
    //    uchar order;
    //    struct r3dPoint3D pos;
    //    ulong targetNetID;
    //};
    //uchar data[0];
    order: Orders = 0
    pos: Vector3 = Vector3.Zero
    targetNetID: number = 0
    data!: MovementDataNormal //= MovementData.None
    public override _type(){ return Type.NPC_IssueOrderReq }
    public override _read(reader: Reader){
        this.order = reader.readByte("order")
        this.pos = Vector3.read(reader, "pos")
        this.targetNetID = reader.readUInt32("targetNetID")
        this.data = new MovementDataNormal()
        this.data._read(reader)
    }
}

export class SynchVersionC2S extends GamePacket {
    //float time_LastClient;
    //ulong clientNetID;
    //char versionString[256];
    time_LastClient: number = 0
    clientNetID: number = 0
    versionString: string = ''
    public override _type(){ return Type.SynchVersionC2S }
    //public override _size(){ return 4 + 4 + 256 }
    public override _read(reader: Reader){
        this.time_LastClient = reader.readFloat("time_LastClient")
        this.clientNetID = reader.readUInt32("clientNetID")
        this.versionString = reader.readFixedString(256)
    }
}

export class World_SendCamera_Server extends GamePacket {
    //struct r3dPoint3D cameraPos;
    //struct r3dPoint3D cameraDir;
    //ulong clientID;
    //uchar syncID;
    cameraPos: Vector3 = Vector3.Zero
    cameraDir: Vector3 = Vector3.Zero
    clientID: number = 0
    syncID: number = 0
    public override _type(){ return Type.World_SendCamera_Server }
    //public override _size(){ return 3*4 + 3*4 + 4 + 1 }
    public override _read(reader: Reader){
        this.cameraPos = Vector3.read(reader, "cameraPos")
        this.cameraDir = Vector3.read(reader, "cameraDir")
        this.clientID = reader.readUInt32("clientID")
        this.syncID = reader.readByte("syncID")
    }
}
export class Barrack_SpawnUnit extends GamePacket {
    //ulong netObjID;
    //uchar netNodeID;
    //uchar waveCount;
    //uchar minionType;
    //short damageBonus;
    //short healthBonus;
}
export class C2S_OnQuestEvent extends GamePacket {
    //uchar questEvent;
    //int questId;
}
export class AddPosPerceptionBubble extends GamePacket {
    //int perceptionBubbleType;
    //ulong clientNetID;
    //float radius;
    //struct r3dPoint3D pos;
    //float timeToLive;
    //ulong bubbleID;
    //ulong flags;
}
export class BuyItemAns extends GamePacket {
    //uchar slot;
    //ulong itemID;
    //uchar itemsInSlot;
    //uchar useOnBought;
}
export class NPC_ForceDead extends GamePacket {
}
export class S2C_HandleGameScore extends GamePacket {
    //int team;
    //int score;
}
export class C2S_PlayEmote extends GamePacket {
    //ulong emotId;
}
export class S2C_ShowHealthBar extends GamePacket {
    //bool show;
}
export class OnReplication extends GamePacket {
    //undefined field5_0x5;
    //undefined field6_0x6;
    //undefined field7_0x7;
    //undefined field8_0x8;
    //undefined field9_0x9;
    //uchar data[0];

    syncID: number = 0
    datas: ReplicationData[] = []

    public override _type(){ return Type.OnReplication }
    public override _write(writer: Writer){
        writer.writeUInt32(this.syncID)
        writer.writeByte(this.datas.length)
        for(const data of this.datas)
            data.write(writer)
    }
}
export class ReplicationData extends BasePacket {
    
    unitNetID: number = 0
    values: number[] = []
    skip: boolean[] = []

    public override _write(writer: Writer){
        writer.writeByte(this.values[0]!)
        writer.writeUInt32(this.unitNetID)
        console.assert(this.values.length == this.skip.length)
        for(let i = 1; i < this.values.length; i++){
            if(this.skip[i]) continue
            writer.writeUInt32(this.values[i]!)
        }
    }
}
/*
export class ReplicationData extends BasePacket {
    
    unitNetID: number = 0
    values: number[][] = []

    public override _read(reader: Reader){
        const primaryIdArray = reader.readByte()
        this.unitNetID = reader.readUInt32()
        for (var primaryId = 0; primaryId < 8; primaryId++){
            if((primaryIdArray & (1 << primaryId)) != 0){
                const secondaryIdArray = reader.readUInt32()
                for (var secondaryId = 0; secondaryId < 32; secondaryId++){
                    if ((secondaryIdArray & (1 << secondaryId)) != 0){
                        const value = reader.readUInt32()
                        this.values[primaryId] ??= []
                        this.values[primaryId]![secondaryId] = value
                    }
                }
            }
        }
    }

    public override _write(writer: Writer){
        
        let primaryIdArray = 0
        for(const primaryId in this.values)
            primaryIdArray |= 1 << Number(primaryId)

        writer.writeByte(primaryIdArray)
        writer.writeUInt32(this.unitNetID)
        
        for(const row of this.values){
        
            let secondaryIdArray = 0
            for(const secondaryId in row)
                secondaryIdArray |= 1 << Number(secondaryId)
            
            writer.writeUInt32(secondaryIdArray)
        
            for(const value of row)
                writer.writeUInt32(value)
        }
    }
}
*/
export class SwapItemReq extends GamePacket {
    //uchar source;
    //uchar dest;
}
export class SynchVersionS2C extends GamePacket {
    
    //bool isVersionOk;
    //int mapToLoad;
    //struct PlayerLiteInfo playerInfo[12];
    //char versionString[256];
    //char mapMode[128];

    isVersionOk: boolean = false
    mapToLoad: number = 0
    playerInfo: PlayerLiteInfo[] = []
    versionString: string = ''
    mapMode: string = ''
    
    public override _type(){ return Type.SynchVersionS2C }
    // public override _size(){
    //     let size = 1 + 4
    //     //size += this.playerInfo.reduce((sum, pi) => sum + pi._size(), 0)
    //     size += PlayerLiteInfo.empty._size() * 12
    //     size += 256 + 128
    //     return size
    // }
    public override _read(reader: Reader){
        this.isVersionOk = reader.readBool("isVersionOk")
        this.mapToLoad = reader.readUInt32("mapToLoad")
        for(let i = 0; i < 12; i++){
            this.playerInfo[i] = new PlayerLiteInfo().read(reader)
        }
        this.versionString = reader.readFixedString(256)
        this.mapMode = reader.readFixedString(128)
    }
    public override _write(writer: Writer){
        writer.writeBool(this.isVersionOk)
        writer.writeUInt32(this.mapToLoad)
        let i = 0;
        for(const pi of this.playerInfo){
            pi.write(writer)
            i++
        }
        for(; i < 12; i++){
            PlayerLiteInfo.empty.write(writer)
        }
        writer.writeFixedString(256, this.versionString)
        writer.writeFixedString(128, this.mapMode)
    }
}

export class PlayerLiteInfo extends BasePacket {

    public static empty = new PlayerLiteInfo()

    // ulong64 ID;
    // ushort summonorLevel;
    // uint summonorSpell1;
    // uint summonorSpell2;
    // bool isBot;
    // int teamId;
    // struct basic_string<char,std::char_traits<char>,std::allocator<char>_> botName;
    // struct basic_string<char,std::char_traits<char>,std::allocator<char>_> botSkinName;
    // int botDifficulty;
    // int profileIconId;

    playerId: bigint = 0xFFFFFFFFFFFFFFFFn //HACK: -1
    summonerLevel: number = 0
    summonerSpell1: number = 0
    summonerSpell2: number = 0
    isBot: boolean = false
    teamId: number = 0
    botName: string = ''
    botSkinName: string = ''
    botDifficulty: number = 0
    profileIconId: number = 0

    //public override _size(){
    //     let size = 8 + 2 + 4 + 4 + 1 + 4
    //     size += 28 //size += Buffer.from(this.botName + '\u0000', 'utf8').length
    //     size += 28 //size += Buffer.from(this.botSkinName + '\u0000', 'utf8').length
    //     size += 4 + 4
    //     return size
    // }
    public override _write(writer: Writer){
        writer.writeUInt64(this.playerId)
        writer.writeUInt16(this.summonerLevel)
        writer.writeUInt32(this.summonerSpell1)
        writer.writeUInt32(this.summonerSpell2)
        writer.writeBool(this.isBot)
        writer.writeUInt32(this.teamId)
        //writer.writeBytes(Buffer.from(this.botName + '\u0000', 'utf8'))
        //writer.writeBytes(Buffer.from(this.botSkinName + '\u0000', 'utf8'))
        writer.writeFixedString(28, this.botName)
        writer.writeFixedString(28, this.botSkinName)
        writer.writeUInt32(this.botDifficulty)
        writer.writeUInt32(this.profileIconId)
    }
    public override _read(reader: Reader){
        this.playerId = reader.readUInt64("playerId")
        this.summonerLevel = reader.readUInt16("summonerLevel")
        this.summonerSpell1 = reader.readUInt32("summonerSpell1")
        this.summonerSpell2 = reader.readUInt32("summonerSpell2")
        this.isBot = reader.readBool("isBot")
        this.teamId = reader.readUInt32("teamId")
        this.botName = reader.readFixedString(28)
        this.botSkinName = reader.readFixedString(28)
        this.botDifficulty = reader.readUInt32("botDifficulty")
        this.profileIconId = reader.readUInt32("profileIconId")
    }
}

export class DampenerSwitchStates extends GamePacket {
    //ushort duration:15;
    //bool newState:1;
}
export class UnitAddGold extends GamePacket {
    //ulong targetNetID;
    //ulong sourceNetID;
    //float gold;
}
export class S2C_AntiBot extends GamePacket {
    //ushort protoID;
    //ushort pktSize;
    //uchar pktData[1024];
}
export class World_LockCamera_Server extends GamePacket {
    //bool lockCamera;
    //ulong clientID;
}
export class C2S_ClientReady extends GamePacket {
}
export class C2S_OnTipEvent extends GamePacket {
    //uchar tipEvent;
    //int tipId;
}
export class WaypointList extends GamePacket {
    //int syncID;
    //struct NetWaypoint dataarray_NWP[0];
}
export class SpawnLevelPropS2C extends GamePacket {
    //ulong netObjID;
    //uchar netNodeID;
    //struct r3dPoint3D pos;
    //struct r3dPoint3D facing;
    //struct r3dPoint3D positionOffset;
    //uint teamID:9;
    //undefined field11_0x30;
    //undefined field12_0x31;
    //uchar skillLevel;
    //uchar rank;
    //uchar type;
    //char name[64];
    //char propName[64];
}
export class CHAR_CancelTargetingReticle extends GamePacket {
    //uchar slot:7;
    //bool isSummonerSpell:1;
}
export class Pause extends GamePacket {
    //struct r3dPoint3D pos;
    //struct r3dPoint3D forward;
    //int syncID;
}
export class World_SendCamera_Server_Acknologment extends GamePacket {
    //uchar syncID;
    syncID: number = 0
    public override _type(){ return Type.World_SendCamera_Server }
    //public override _size(){ return 1 }
    public override _read(reader: Reader){
        this.syncID = reader.readByte("syncID")
    }
    public override _write(writer: Writer){
        writer.writeByte(this.syncID)
    }
}
export class Basic_Attack extends GamePacket {
    
    //struct Common_Basic_Attack data;

    public targetNetID: number = 0
    public extraTime: number = 0
    public missileNextID: number = 0
    public attackSlot: number = 0

    public override _type(){ return Type.Basic_Attack }
    public override _read(reader: Reader){
        this.targetNetID = reader.readUInt32();
        this.extraTime = (reader.readByte() - 128) / 100.0;
        this.missileNextID = reader.readUInt32();
        this.attackSlot = reader.readByte();
    }
    public override _write(writer: Writer){
        writer.writeUInt32(this.targetNetID);
        writer.writeByte(Math.floor((this.extraTime * 100.0) + 128));
        writer.writeUInt32(this.missileNextID);
        writer.writeByte(this.attackSlot);
    }
}
export class Basic_Attack_Pos extends Basic_Attack {
    
    //struct Common_Basic_Attack data;
    //float pos[2];

    public position: Vector2 = Vector2.Zero

    public override _type(){ return Type.Basic_Attack_Pos }
    public override _read(reader: Reader){
        this.position = Vector2.read(reader)
    }
    public override _write(writer: Writer){
        Vector2.write(writer, this.position)
    }
}
export class NPC_Die_Broadcast extends GamePacket {
    //undefined field5_0x5;
    //undefined field6_0x6;
    //undefined field7_0x7;
    //undefined field8_0x8;
    //undefined field9_0x9;
    //undefined field10_0xa;
    //undefined field11_0xb;
    //undefined field12_0xc;
    //undefined field13_0xd;
    //undefined field14_0xe;
    //undefined field15_0xf;
}
export class S2C_PopCharacterData extends GamePacket {
    //ulong id;
}
export class S2C_ColorRemapFX extends GamePacket {
    //char isFadingIn;
    //float fadeTime;
    //int teamID;
    //struct r3dColor color;
    //float maxWeight;
}
export class C2S_OnShopOpened extends GamePacket {
}
export class NPC_BuffRemoveGroup extends GamePacket {
    //uint buffNameHash;
    //uchar numInGroup;
}
export class S2C_PlayVOAudioEvent extends GamePacket {
    //char folderName[64];
    //char eventID[64];
    //uchar callbackType;
    //ulong audioEventNetworkID;
}
export class S2C_RefreshObjectiveText extends GamePacket {
    //char textStringID[128];
}
export class Connected extends GamePacket {
    //ulong clientID;
}
export class S2C_Exit extends GamePacket {
    //ulong cid;
}

abstract class Ping_Load_Info extends GamePacket {

    //    ulong clientID;
    //    ulong64 playerID;
    //    float percentage;
    //    float ETA;
    //    int count:16;
    //    ulong ping:15;
    //    bool ready:1;

    clientID: number = 0
    playerID: bigint = 0n
    percentage: number = 0
    ETA: number = 0
    count: number = 0
    ping: number = 0
    ready: boolean = false

    //public override _size(){ return 4 + 8 + 4 + 4 + 4 + 4 }
    public override _read(reader: Reader){
        this.clientID = reader.readUInt32("clientID")
        this.playerID = reader.readUInt64("playerID")
        this.percentage = reader.readFloat("percentage")
        this.ETA = reader.readFloat("ETA")
        this.count = reader.readUInt16("count")
        this.ping = reader.readUInt16("ping")
        this.ready = reader.readBool("ready")
    }
    public override _write(writer: Writer){
        writer.writeUInt32(this.clientID)
        writer.writeUInt64(this.playerID)
        writer.writeFloat(this.percentage)
        writer.writeFloat(this.ETA)
        writer.writeUInt16(this.count)
        writer.writeUInt16(this.ping)
        writer.writeBool(this.ready)
    }
}
export class C2S_Ping_Load_Info extends Ping_Load_Info {
    //struct ConnectionInfo info;
    public override _type(){ return Type.C2S_Ping_Load_Info }
}
export class S2C_Ping_Load_Info extends Ping_Load_Info {
    //struct ConnectionInfo info;
    public override _type(){ return Type.S2C_Ping_Load_Info }
}

export class ServerTick extends GamePacket {
    //float delta;
}
export class AI_TargetS2C extends GamePacket {
    //ulong targetID;
}
export class ResumePacket extends GamePacket {
    //ulong clientID;
    //bool delayed:1;
}
export class SyncMissionStartTimeS2C extends GamePacket {
    //float startTime;
}
export class UnitApplyHeal extends GamePacket {
    //float maxHP;
    //float heal;
}
export class C2S_StatsUpdateReq extends GamePacket {
}
export class S2C_FX_OnEnterTeamVisiblity extends GamePacket {
    //ulong netID;
    //uchar team;
}
export class FX_Create {
    //ulong targetNetID;
    //ulong netAssignedID;
    //ulong bindNetID;
    //short posX;
    //float posY;
    //short posZ;
    //short targetPosX;
    //float targetPosY;
    //short targetPosZ;
    //short ownerPosX;
    //float ownerPosY;
    //short ownerPosZ;
    //struct r3dPoint3D orientationVector;
    //float timeSpent;
}
export class StartSession {
    //char clientname[128];
    //char localaddr[128];
    //char hostname[128];
    //char hostaddr[128];
    //ulong hostport;
    //bool hasClient;
    //bool hasServer;
}
