class_name Checkbox extends InputHandler

@export var label: Label
@export var container: Container
@export var checkbox: PackedScene
@export var button: Button

func init(config: Dictionary, cb: Callable) -> void:
    for choice: Dictionary in config['choices']:
        var instance: CheckboxButton = checkbox.instantiate()
        instance.text = choice['name']
        instance.value = choice['value']
        container.add_child(instance)
    button.pressed.connect(submit)
    label.text = config['message']
    callback = cb

var callback: Callable
func submit() -> void:
    var values := []
    for child: CheckboxButton in container.get_children():
        if child.is_visible() && child.is_pressed():
            values.append(child.value)
    callback.call(values)

func abort() -> void:
    queue_free()
