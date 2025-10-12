class_name ConnectionsPanelLine extends ShowableView

var id: Variant
@export var icon_button: Button
@export var name_label: Label
@export var status_label: Label

func init(config: Dictionary, callback: Callable) -> void:
    super.init(config, callback)

    self.id = config['id']
    #self.icon_button.texture = load()
    self.name_label.text = config['name']
    self.status_label.text = config['status']
