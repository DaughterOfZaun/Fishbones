class_name ServerNode extends Control

const JSONRPC_GUI_ARG = "--jrpc-ui"

var stdio: FileAccess
var stderr: FileAccess
var pid: int = 0
var json := JSON.new()
var jrpc := JSONRPC.new()
var methods: Dictionary[String, Callable] = {}

@export var views: Dictionary[String, ShowableView]

var visible_views_stack: Array[ShowableView] = []
func show_view(view: ShowableView) -> void:
    if !view.is_top_level: return
    visible_views_stack.erase(view)
    visible_views_stack.append(view)
    just_show_view(view)

func hide_view(view: ShowableView) -> void:
    if !view.is_top_level: return
    visible_views_stack.erase(view)
    if visible_views_stack.size() > 0:
        just_show_view(visible_views_stack[-1])
    view.visible = false

func just_show_view(view: Control) -> void:
    var current_node: Control = view
    while current_node != null && current_node != container:
        current_node.visible = true
        current_node = current_node.get_parent() as Control

@export_group("Spawnable Components")
@export var bar: PackedScene
@export var spinner: PackedScene
@export var select: PackedScene
@export var checkbox: PackedScene
@export var input: PackedScene
@export_group("")

var handlers: Dictionary[Variant, InputHandler] = {}

@export_file var embedded_js: String
@export_file var embedded_exe: String
@export_file var embedded_lib_0: String

@onready var embedded_libs: Array[String] = [
    embedded_js,
    embedded_exe,
    embedded_lib_0,
]

@export_group('Embedded Files', 'embedded_file_')
@export_file var embedded_file_0: String
@export_file var embedded_file_1: String
@export_file var embedded_file_2: String
@export_file var embedded_file_3: String
@export_file var embedded_file_4: String
@export_file var embedded_file_5: String
@export_file var embedded_file_6: String
@export_file var embedded_file_7: String
@export_file var embedded_file_8: String
@export_file var embedded_file_9: String
@export_file var embedded_file_a: String
@export_file var embedded_file_b: String
@export_file var embedded_file_c: String
@export_file var embedded_file_d: String
@export_file var embedded_file_e: String
@export_file var embedded_file_f: String
@export_file var embedded_file_g: String
@export_file var embedded_file_h: String
@export_group('')

@onready var embedded_files: Array[String] = [
    embedded_file_0,
    embedded_file_1,
    embedded_file_2,
    embedded_file_3,
    embedded_file_4,
    embedded_file_5,
    embedded_file_6,
    embedded_file_7,
    embedded_file_8,
    embedded_file_9,
]

@export_group("Static Elements")
@export var container: Control
@export var bars_container: Container
@export var show_console_toggle: Button
@export var console_container: Container
@export var console: RichTextLabel
@export var popup: CustomPopup
@export_group("")

var active_bars_count := 0
func inc_active_bars_count(by: int) -> void:
    active_bars_count += by
    bars_container.visible = active_bars_count > 0
    console_container.visible = active_bars_count > 0 || show_console_toggle.button_pressed
    show_console_toggle.visible = active_bars_count <= 0

func get_named_arg(args: PackedStringArray, name: String, default: String) -> String:
    var arg_index := args.find(name)
    return args[arg_index + 1] \
    if arg_index >= 0 && arg_index < args.size() \
    else default

var current_exe := OS.get_executable_path()
var cwd := current_exe.get_base_dir()
var downloads_dir_name := "Fishbones_Data"
var downloads := cwd.path_join(downloads_dir_name)
var embedded_files_by_name: Dictionary[String, String] = {}

const rwx = \
    FileAccess.UNIX_READ_OWNER |\
    FileAccess.UNIX_WRITE_OWNER |\
    FileAccess.UNIX_EXECUTE_OWNER

func _ready() -> void:
    var err: Error

    #printerr('Godot Engine started')

    var exe_args := []
    #var args := OS.get_cmdline_args()
    #var exe := get_named_arg(args, "--exe", "../Fishbones.exe")
    #var exe_args_str := get_named_arg(args, "--exe-args", '[]')
    #var exe_args := JSON.parse_string(exe_args_str) as Array
    #if exe_args == null: exe_args = []
    #var exe := exe_args[0]; exe_args.remove_at(0); if !exe: exe = '../Fishbones.exe'

    err = DirAccess.make_dir_absolute(downloads); assert(err in [ OK, ERR_ALREADY_EXISTS ])

    var fb_dir := downloads.path_join('Fishbones')
    err = DirAccess.make_dir_absolute(fb_dir); assert(err in [ OK, ERR_ALREADY_EXISTS ])

    #var copied_exe := fb_dir.path_join('Fishbones.exe')
    #var current_exe_mod_time := FileAccess.get_modified_time(current_exe)
    #var copied_exe_mod_time := FileAccess.get_modified_time(copied_exe)
    #if current_exe_mod_time > copied_exe_mod_time:
    #    err = DirAccess.copy_absolute(current_exe, copied_exe); assert(err == OK)

    for file in embedded_files:
        embedded_files_by_name[file.get_file()] = file

    var extracted_js := downloads.path_join(embedded_js.get_file())
    var extracted_exe := downloads.path_join(embedded_exe.get_file())
    for embedded_file in embedded_libs:
        var extracted_file := downloads.path_join(embedded_file.get_file())
        #var embedded_file_mod_time := FileAccess.get_modified_time(embedded_file)
        #var extracted_file_mod_time := FileAccess.get_modified_time(extracted_file)
        #print(embedded_file.get_file(), ' ', embedded_file_mod_time, ' vs ', extracted_file_mod_time)
        #if current_exe_mod_time > extracted_file_mod_time:
        if !FileAccess.file_exists(extracted_file):
            err = DirAccess.copy_absolute(embedded_file, extracted_file); #assert(err == OK)
            if extracted_file.get_extension() == "exe":
                err = FileAccess.set_unix_permissions(extracted_file, rwx); #assert(err == OK)

    exe_args.append_array([ extracted_js ])
    exe_args.append_array(OS.get_cmdline_user_args())
    exe_args.append_array([ JSONRPC_GUI_ARG, current_exe ])

    var dict := OS.execute_with_pipe(extracted_exe, exe_args, false)
    stdio = dict["stdio"]
    stderr = dict["stderr"]
    pid = dict["pid"]

    inc_active_bars_count(0)
    show_console_toggle.toggled.connect(
        func(toggled_on: bool) -> void:
            console_container.visible = toggled_on
            show_console_toggle.text = '✕' if toggled_on else '>_  '
    )

    for view_name in views:
        var view := views[view_name]
        view.visible = false

    get_tree().set_auto_accept_quit(false)

func _notification(what: int) -> void:
    if what == NOTIFICATION_WM_CLOSE_REQUEST:
        waiting_for_exit = true
        #if stderr: stderr.close()
        #if stdio: stdio.close()
        if pid and OS.is_process_running(pid):
            var timer := get_tree().create_timer(7)
            var os_kill_pid := func () -> void: OS.kill(pid)
            timer.timeout.connect(os_kill_pid)
            notify('exit')
        else:
            on_process_exit()

func _init() -> void:

    methods["console.log"] = func(...params: Array[Variant]) -> void:
        #print('console.log', ' ', params)
        console.append_text(" ".join(params).replace('\n', '[br]') + '\n')

    methods["copy"] = func(config: Dictionary) -> void:
        var from: String = config['from']
        var to: String = config['to']

        var err := OK
        var id: Variant = last_call_id

        from = embedded_files_by_name.get(from.get_file(), "")
        if from.is_empty():
            err = ERR_FILE_NOT_FOUND
            reject(id, err, error_string(err))
            return

        #console.append_text('downloads: ' + downloads + '\n')
        #console.append_text('to: ' + to + '\n')

        #to = downloads.path_join(to.get_file())
        #if !to.begins_with(downloads) || to.contains('..'):
        if !to.contains(downloads_dir_name) || to.contains('..'):
            err = ERR_FILE_NO_PERMISSION
            reject(id, err, error_string(err))
            return

        err = DirAccess.copy_absolute(from, to)
        if err != OK:
            reject(id, err, error_string(err))
        else:
            resolve(id, err)

    methods["bar.create"] = func(operation: String, filename: String, size: int) -> void:
        var config := {
            'operation': operation,
            'filename': filename,
            'size': size,
        }
        #print('bar.create', ' ', last_call_id, ' ', config)
        create_element('bar', bar, config, bars_container)
        inc_active_bars_count(+1)

    methods["bar.update"] = func(value: float) -> void:
        #print('bar.update', ' ', last_call_id, ' ', value)
        var instance: Bar = handlers[last_call_id]
        instance.update(value)

    methods["bar.stop"] = func() -> void:
        #print('bar.stop', ' ', last_call_id)
        handlers[last_call_id].abort()
        inc_active_bars_count(-1)

    methods["spinner"] = func(config: Dictionary) -> void:
        create_element('spinner', spinner, config)

    methods["select"] = func(config: Dictionary) -> void:
        create_element('select', select, config)

    methods["select.update"] = func(choices: Array) -> void:
        #print('select.update', ' ', last_call_id, ' ', choices)
        var instance: Select = handlers[last_call_id]
        instance.update(choices)

    methods["checkbox"] = func(config: Dictionary) -> void:
        create_element('checkbox', checkbox, config)

    methods["input"] = func(config: Dictionary) -> void:
        create_element('input', input, config)

    methods["abort"] = func() -> void:
        #print('abort', ' ', last_call_id)
        abort_handler(last_call_id)

    methods["view"] = func(config: Dictionary) -> void:
        var instance := create_view(config)
        container.add_child(instance)

    methods["render"] = func(name: String, config: Dictionary, hidden: bool) -> void:
        var instance := views[name]
        instance.is_hidden = hidden
        instance.is_top_level = true
        var bound_callback := bind(callback, last_call_id)
        #print('BOUND ', bound_callback.hash(), ' TO ', last_call_id)
        instance.init({}, bound_callback)
        instance.update(config, true)
        handlers[last_call_id] = instance

    methods["exit"] = func() -> void:
        #print('exit')
        #get_tree().quit()
        waiting_for_exit = true

    methods["popup"] = func(title: String, message: String, sound: String) -> void:
        popup.pop(title, message, sound)

var waiting_for_exit := false

func create_view(config: Dictionary) -> InputHandler:

    var path: String = config['path']
    var scene: PackedScene = load(path)
    var instance: InputHandler = scene.instantiate()
    var config_config: Dictionary = config['config']
    var cb := bind(callback, last_call_id)
    handlers[last_call_id] = instance

    last_call_id += 1

    var new_subviews: Dictionary[String, InputHandler] = {}
    var config_subviews: Dictionary = config.get('subviews', {})
    for slot: String in config_subviews:
        new_subviews[slot] = create_view(config_subviews[slot])

    config_config['subviews'] = new_subviews
    instance.init(config_config, cb)

    return instance

func bind(cb: Callable, arg0: Variant) -> Callable:
    return func(...args: Array) -> Variant:
        args.push_front(arg0)
        return cb.callv(args)

func create_element(_el_name: String, scene: PackedScene, config: Dictionary, container: Control = self.container) -> void:
    #print(el_name, ' ', last_call_id, ' ', config)
    var instance: InputHandler = scene.instantiate()
    instance.init(config, bind(resolve_or_reject, last_call_id))
    handlers[last_call_id] = instance
    container.add_child(instance)

func _process(_delta: float) -> void:

    while stdio:
        var line := stdio.get_line()
        var err := stdio.get_error()
        if err != 14: print(err, ' ', line)

        if !line: break

        line = line.strip_edges()
        if line.begins_with('{') && line.ends_with('}'):
            _process_packet(line)

    #TODO:
    while stderr:
       var line := stderr.get_line()
       if !line: break
       print('ERROR: ', line)
       console.append_text(
            '[color=light_coral]ERROR: {line}[/color]\n'
            .format({ 'line': line })
        )

    if !OS.is_process_running(pid):
        on_process_exit()
        return

func on_process_exit() -> void:

    if waiting_for_exit:
        get_tree().quit()
        return

    console.append_text(
        '[color=light_coral]Process exited with code {code}[/color]\n'
        .format({ 'code': OS.get_process_exit_code(pid) })
    )
    show_console_toggle.button_pressed = true
    console_container.visible = true
    set_process(false)

func _process_packet(packet_string: String) -> void:
    var response_string := await _process_string(packet_string)
    if response_string.is_empty(): return
    #print('response', ' ', response_string)
    stdio.store_string(response_string + '\n')
    stdio.flush()

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

    var var_callable: Variant = null
    if id != null:
        var handler: InputHandler = handlers.get(id, null_InputHandler)
        if handler != null_InputHandler:
            var_callable = handler.get(method)
    if var_callable == null:
        var_callable = methods.get(method)
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

func resolve_or_reject(id: Variant, result: Variant = null) -> void:
    if result != null: resolve(id, result)
    else: reject(id, FAILED, 'Operation was aborted')

func resolve(id: Variant, result: Variant = null) -> void:
    var response_string := JSON.stringify(jrpc.make_response(result, id))
    print('resolve', ' ', response_string)
    stdio.store_string(response_string + '\n')
    abort_handler(id)
    stdio.flush()

func reject(id: Variant, code: int, message: String) -> void:
    var response_string := JSON.stringify(jrpc.make_response_error(code, message, id))
    print('reject', ' ', response_string)
    stdio.store_string(response_string + '\n')
    abort_handler(id)
    stdio.flush()

func callback(id: Variant, method: String, ...params: Array[Variant]) -> void:
    var response_string := JSON.stringify(jrpc.make_request(method, params, id))
    print('callback', ' ', response_string)
    stdio.store_string(response_string + '\n')
    if method == 'resolve' || method == 'reject':
        abort_handler(id)
    stdio.flush()

func notify(method: String, ...params: Array[Variant]) -> void:
    var response_string := JSON.stringify(jrpc.make_notification(method, params))
    print('notify', ' ', response_string)
    stdio.store_string(response_string + '\n')
    stdio.flush()

var null_InputHandler := InputHandler.new() #HACK:
func abort_handler(id: Variant) -> void:
    var handler: InputHandler = handlers.get(id, null_InputHandler)
    if handler != null_InputHandler:
        handlers.erase(id)
        handler.abort()
