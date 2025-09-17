class_name Line extends InputHandler

@export var label: Label
@export var field: LineEdit
@export var button: Button

func init(config: Dictionary, cb: Callable) -> void:
    field.text_submitted.connect(submit)
    button.pressed.connect(submit)
    field.text = config.get('default', '')
    label.text = config['message']
    callback = cb

var callback: Callable
func submit(_new_text: String = '') -> void:
    callback.call(field.text)
