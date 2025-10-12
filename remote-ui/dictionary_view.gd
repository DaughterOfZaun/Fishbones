class_name DictionaryView extends ShowableView

@export var elements: Dictionary[String, Control]

func init(config: Dictionary, cb: Callable) -> void:
    super.init(config, cb)
    for key in elements:
        var value := elements[key]
        if value is ShowableView:
            (value as ShowableView).init({}, cb)

func update(config: Dictionary) -> void:
    for key: String in config:
        var value: Variant = config[key]
        var control: Control = self.elements[key]
        if control is Label: (control as Label).text = value
        if control is LineEdit: (control as LineEdit).text = value
        if control is CheckBox: (control as CheckBox).button_pressed = value
        if control is ShowableView: (control as ShowableView).update(value)
