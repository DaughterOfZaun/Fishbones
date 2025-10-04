extends InputHandler

@export var exported_text: TextEdit
@export var imported_text: TextEdit
@export var copy_button: Button
@export var paste_button: Button
@export var connect_button: Button
@export var cancel_button: Button

func init(config: Dictionary, callback: Callable) -> void:
    exported_text.text = config['default']
    copy_button.pressed.connect(func () -> void:
        DisplayServer.clipboard_set(exported_text.text)
    )
    paste_button.pressed.connect(func () -> void:
        imported_text.text = DisplayServer.clipboard_get()
    )
    connect_button.pressed.connect(func () -> void:
        callback.call('resolve', imported_text.text)
    )
    cancel_button.pressed.connect(func () -> void:
        callback.call('resolve', null)
    )

func update(text: String) -> void:
    exported_text.text = text
