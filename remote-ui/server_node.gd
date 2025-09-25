class_name ServerNode extends Control

const NO_RELAUNCH_ARG = "--no-gui"
const JSONRPC_GUI_ARG = "--jrpc-ui"

var stdio: FileAccess
var stderr: FileAccess
var pid: int = 0
var json := JSON.new()
var jrpc := JSONRPC.new()
var methods: Dictionary[String, Callable] = {}

@export var bar: PackedScene
@export var spinner: PackedScene
@export var select: PackedScene
@export var checkbox: PackedScene
@export var input: PackedScene

var handlers: Dictionary[Variant, InputHandler] = {}

@export_group('Embded Files', 'embded_file_')
@export_file var embded_file_0: String
@export_file var embded_file_1: String
@export_file var embded_file_2: String
@export_file var embded_file_3: String
@export_file var embded_file_4: String
@export_file var embded_file_5: String
@export_file var embded_file_6: String
@export_file var embded_file_7: String
@export_file var embded_file_8: String
@export_file var embded_file_9: String
@export_file var embded_file_a: String
@export_file var embded_file_b: String
@export_group('')

var embded_files := [
    embded_file_0,
    embded_file_1,
    embded_file_2,
    embded_file_3,
    embded_file_4,
    embded_file_5,
    embded_file_6,
    embded_file_7,
    embded_file_8,
    embded_file_9,
    embded_file_a,
    embded_file_b,
]

@export var container: Control
@export var bars_container: Container
@export var show_console_toggle: Button
@export var console_container: Container
@export var console: RichTextLabel

var active_bars_count := 0
func inc_active_bars_count(by: int) -> void:
    active_bars_count += by
    bars_container.visible = active_bars_count > 0
    console_container.visible = active_bars_count > 0 || show_console_toggle.button_pressed
    show_console_toggle.visible = active_bars_count <= 0

func _ready() -> void:
    var args := OS.get_cmdline_args()
    var exe_arg_index := args.find("--exe")
    assert(exe_arg_index < args.size())
    var exe := args[exe_arg_index + 1]

    var dict := OS.execute_with_pipe(exe, PackedStringArray([ NO_RELAUNCH_ARG, JSONRPC_GUI_ARG ]), false)
    stdio = dict["stdio"]
    stderr = dict["stderr"]
    pid = dict["pid"]

    inc_active_bars_count(0)
    show_console_toggle.toggled.connect(
        func(toggled_on: bool) -> void:
            console_container.visible = toggled_on
            show_console_toggle.text = 'x' if toggled_on else '!'
    )

#     get_tree().set_auto_accept_quit(false)

# func _notification(what: int) -> void:
#     if what == NOTIFICATION_WM_CLOSE_REQUEST:
#         if stderr: stderr.close()
#         if stdio: stdio.close()
#         if pid: OS.kill(pid)
#         get_tree().quit()
    
func _init() -> void:
    
    methods["console.log"] = func(...params: Array[Variant]) -> void:
        print('console.log', ' ', params)
        console.append_text(" ".join(params).replace('\n', '[br]') + '\n')
    
    methods["bar.create"] = func(operation: String, filename: String, size: int) -> void:
        var config := {
            'operation': operation,
            'filename': filename,
            'size': size,
        }
        print('bar.create', ' ', last_call_id, ' ', config)
        create_element('bar', bar, config, bars_container)
        inc_active_bars_count(+1)
    
    methods["bar.update"] = func(value: float) -> void:
        print('bar.update', ' ', last_call_id, ' ', value)
        var instance: Bar = handlers[last_call_id]
        instance.update(value)
    
    methods["bar.stop"] = func() -> void:
        print('bar.stop', ' ', last_call_id)
        handlers[last_call_id].abort()
        inc_active_bars_count(-1)
    
    methods["spinner"] = func(config: Dictionary) -> void:
        create_element('spinner', spinner, config)
    
    methods["select"] = func(config: Dictionary) -> void:
        create_element('select', select, config)
    
    methods["select.update"] = func(choices: Array) -> void:
        print('select.update', ' ', last_call_id, ' ', choices)
        var instance: Select = handlers[last_call_id]
        instance.update(choices)
    
    methods["checkbox"] = func(config: Dictionary) -> void:
        create_element('checkbox', checkbox, config)
    
    methods["input"] = func(config: Dictionary) -> void:
        create_element('input', input, config)

    methods["abort"] = func() -> void:
        print('abort', ' ', last_call_id)
        handlers[last_call_id].abort()

    methods["exit"] = func() -> void:
        print('exit')
        get_tree().quit()

func bind(cb: Callable, arg0: Variant) -> Callable:
    return func(arg1: Variant) -> Variant:
        return cb.call(arg0, arg1) 

func create_element(el_name: String, scene: PackedScene, config: Dictionary, container: Control = self.container) -> void:
    print(el_name, ' ', last_call_id, ' ', config)
    var instance: InputHandler = scene.instantiate()
    instance.init(config, bind(answer, last_call_id))
    handlers[last_call_id] = instance
    container.add_child(instance)

func _process(_delta: float) -> void:
    while stdio:
        var line := stdio.get_line()
        #var err := stdio.get_error() #14
        #print(err, line)

        if !line: break

        line = line.strip_edges()
        if line.begins_with('{') && line.ends_with('}'):
            _process_packet(line)

    #TODO:
    #while stderr:
    #    var line := stderr.get_as_text()
    #    if !line: break
    #    print('ERROR: ', line)

func _process_packet(packet_string: String) -> void:
    var response_string := await _process_string(packet_string)
    if response_string.is_empty(): return
    print('response', ' ', response_string)
    stdio.store_string(response_string)

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
    
    var var_method: Variant = dict.get("method", null) as String
    if var_method == null:
        return jrpc.make_response_error(JSONRPC.INVALID_REQUEST, "Invalid Request")
    var method: String = var_method

    var id: Variant = dict.get("id", null)

    var var_callable: Variant = methods.get(method) as Callable
    if var_callable == null:
        return jrpc.make_response_error(JSONRPC.METHOD_NOT_FOUND, "Method not found: " + method, id)
    var callable: Callable = var_callable

    var var_args: Variant = dict.get("params", null) as Array
    if var_args == null: var_args = []
    var args: Array = var_args

    last_call_id = id
    var _call_ret: Variant = await callable.callv(args)

    #if id == null: return null
    #return jrpc.make_response(call_ret, id)
    return null

func answer(id: Variant, result: Variant) -> void:
    var response_string := JSON.stringify(jrpc.make_response(result, id))
    print('response', ' ', response_string)
    stdio.store_string(response_string)
    handlers[last_call_id].abort()
    handlers.erase(id)
