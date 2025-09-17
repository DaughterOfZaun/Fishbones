class_name Select extends InputHandler

@export var label: Label
@export var container: Container
@export var button: PackedScene

func init(config: Dictionary, cb: Callable) -> void:
    label.text = config['message']
    for choice: Dictionary in config['choices']:
        var instance: SelectButton = button.instantiate()
        instance.label.text = choice['name']
        instance.button.disabled = choice.get('disabled', false)
        var value: Variant = choice['value']
        instance.button.pressed.connect(cb.bind(value))
        container.add_child(instance)

func update(_choices: Array[Dictionary]) -> void:
    pass
