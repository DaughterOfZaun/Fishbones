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
    update_select(container, button, choices, init_seq, update_seq)

func init_seq(instance: SelectButton) -> void:
    var obp := on_button_pressed.bind(instance)
    instance.button.pressed.connect(obp)
    
func update_seq(instance: SelectButton, choice: Dictionary) -> void:
    var disabled: bool = choice.get('disabled', false)
    instance.button.disabled = disabled
    instance.label.text = choice['name']
    instance.label.modulate = \
        Color.DARK_GRAY if disabled else Color.WHITE
    instance.value = choice['value']

func on_button_pressed(instance: SelectButton) -> void:
    callback.call(instance.value)
