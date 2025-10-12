extends ShowableView

@export var placeholder_label: Label
@export var container: Container
@export var line: PackedScene
@export var host_button: Button
@export var quit_button: Button

var callback: Callable

func _ready() -> void:
    host_button.pressed.connect(func() -> void: self.callback.call('host'))
    quit_button.pressed.connect(func() -> void: self.callback.call('quit'))

func init(config: Dictionary, cb: Callable) -> void:
    super.init(config, callback)
    
    placeholder_label.text = config['default']
    var choices: Array = config['choices']
    self.update(choices)
    self.callback = cb

func update(choices: Array) -> void:
    placeholder_label.visible = len(choices) == 0
    update_select(container, line, choices, init_seq, update_seq)

func init_seq(instance: CustomsBrowserLine) -> void:
    var obp := on_button_pressed.bind(instance)
    instance.button.pressed.connect(obp)

func update_seq(instance: CustomsBrowserLine, config: Dictionary) -> void:
    for key: String in config:
        var value: Variant = config[key]
        if key == 'value':
            instance.value = value
        else:
            var control: Control = instance.labels[key]
            if control is Label: (control as Label).text = value
            if control is CheckBox: (control as CheckBox).button_pressed = value
            
func on_button_pressed(instance: CustomsBrowserLine) -> void:
    self.callback.call('join', instance.value)
