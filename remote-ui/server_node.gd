class_name ServerNode
extends Node

var peer := PacketPeerUDP.new()
var jrpc := JSONRPC.new()
var json := JSON.new()
var methods: Dictionary[String, Callable] = {}

func _ready() -> void:
    var args := OS.get_cmdline_user_args()
    var port_arg_index := args.find("--port")
    assert(port_arg_index < args.size())
    var port := int(args[port_arg_index + 1])

    peer.connect_to_host("127.0.0.1", port)
    
    var notification_string := JSON.stringify(jrpc.make_notification("started", []))
    peer.put_packet(notification_string.to_utf8_buffer())

func _process(_delta: float) -> void:
    while peer.get_available_packet_count() > 0:
        _process_packet(peer.get_packet())

func _process_packet(array_bytes: PackedByteArray) -> void:
    var packet_string := array_bytes.get_string_from_utf8()
    var response_string := await _process_string(packet_string)
    if response_string.is_empty(): return
    peer.put_packet(response_string.to_utf8_buffer())

#src: godot/blob/master/modules/jsonrpc/jsonrpc.cpp
func _process_string(input: String) -> String:
    if input.is_empty(): return ""

    var ret: Variant    
    if json.parse(input) == OK:
        ret = await _process_action(json.get_data())
    else:
        ret = jrpc.make_response_error(JSONRPC.PARSE_ERROR, "Parse error")

    if ret == null: return ""
    return JSON.stringify(ret)

var last_call_id: Variant
func get_last_id() -> Variant:
    return last_call_id

func _process_action(action: Variant) -> Variant:
    var dict := action as Dictionary
    if dict == null:
        return jrpc.make_response_error(JSONRPC.INVALID_REQUEST, "Invalid Request")
    
    var method := dict.get("method", null) as String
    if method == null:
        return jrpc.make_response_error(JSONRPC.INVALID_REQUEST, "Invalid Request")
    
    var id: Variant = dict.get("id", null)

    var callable: Callable = methods.get(method)
    if !callable:
        return jrpc.make_response_error(JSONRPC.METHOD_NOT_FOUND, "Method not found: " + method, id)

    var args := dict.get("params", null) as Array
    if args == null: args = []

    last_call_id = id
    var call_ret: Variant = await callable.callv(args)

    #if id == null: return null
    #return jrpc.make_response(call_ret, id)
    return null

func answer(id: Variant, result: Variant) -> void:
    var response_string := JSON.stringify(jrpc.make_response(result, id))
    peer.put_packet(response_string.to_utf8_buffer())
