class_name Spinner extends InputHandler

@export var label: Label
@export var button: Button

var callback: Callable
func init(config: Dictionary, cb: Callable) -> void:
    label.text = config['message']
    self.callback = cb

func _ready() -> void:
    button.pressed.connect(on_button_pressed)
    
func on_button_pressed() -> void:
    callback.call()
