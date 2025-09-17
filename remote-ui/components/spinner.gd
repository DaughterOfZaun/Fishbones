class_name Spinner extends InputHandler

@export var label: Label

func init(config: Dictionary, _cb: Callable) -> void:
    label.text = config['message']
