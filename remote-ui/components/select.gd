class_name Select extends InputHandler

@export var label: Label
@export var container: Container
@export var button: PackedScene

var callback: Callable

func init(config: Dictionary, cb: Callable) -> void:
    label.text = config['message']
    update(config['choices'])
    callback = cb

func update(var_choices: Variant) -> void:
    var choices: Array = var_choices
    
    #for i in range(max(0, container.get_child_count() - len(choices))):
    for i in range(container.get_child_count() - 1, -1, -1):
        var instance: SelectButton = container.get_child(i)
        container.remove_child(instance)
        instance.queue_free()

    #for i in range(max(0, len(choices) - container.get_child_count())):
    for i in range(len(choices)):
        var instance: SelectButton = button.instantiate()
        var obp := on_button_pressed.bind(instance)
        instance.button.pressed.connect(obp)
        container.add_child(instance)

    for i in range(len(choices)):
        var choice: Dictionary = choices[i]
        var instance: SelectButton = container.get_child(i)
        var disabled: bool = choice.get('disabled', false)
        instance.button.disabled = disabled
        instance.label.text = choice['name']
        instance.label.modulate = \
            Color.DARK_GRAY if disabled else Color.WHITE
        instance.value = choice['value']

func on_button_pressed(instance: SelectButton) -> void:
    callback.call(instance.value)
