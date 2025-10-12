extends ShowableView

@export var exported_text: TextEdit
@export var imported_text: TextEdit
@export var copy_button: Button
@export var paste_button: Button
@export var connect_button: Button
@export var cancel_button: Button
@export var error_label: Label

var callback: Callable

func _ready() -> void:
    imported_text.text = ''
    error_label.visible = false
    imported_text.text_changed.connect(on_imported_text_changed)
    imported_text.text_set.connect(on_imported_text_changed)
    
    copy_button.pressed.connect(func () -> void:
        DisplayServer.clipboard_set(exported_text.text)
    )
    paste_button.pressed.connect(func () -> void:
        imported_text.text = DisplayServer.clipboard_get()
    )
    connect_button.pressed.connect(func () -> void:
        callback.call('resolve', imported_text.text)
        connect_button.disabled = true
        error_label.visible = false
        imported_text.text = ''
        self.abort()
    )
    cancel_button.pressed.connect(func () -> void:
        callback.call('resolve', null)
        self.abort()
    )

func on_imported_text_changed() -> void:
    connect_button.disabled = true
    if imported_text.text.is_empty():
        error_label.visible = false
    else:
        callback.call('validate', imported_text.text)

func validate(err: Variant) -> void:
    connect_button.disabled = !!err
    error_label.visible = !!err
    if typeof(err) == TYPE_STRING:
        error_label.text = err

func init(config: Dictionary, cb: Callable) -> void:
    super.init(config, cb)
    self.exported_text.text = config['default']
    self.callback = cb

func update(text: String) -> void:
    exported_text.text = text
