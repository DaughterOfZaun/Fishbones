class_name Bar extends InputHandler

@export var bar: ProgressBar
@export var label: Label

func init(config: Dictionary, _cb: Callable) -> void:
    label.text = '%s %s...' % [ config['operation'], config['filename'] ]
    bar.max_value = config['size']
    bar.min_value = 0

func update(value: Variant) -> void:
    bar.value = value
