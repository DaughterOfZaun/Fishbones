extends ShowableView

@export var direct_connect_button: Button
@export var placeholder_label: Label
@export var container: Container
@export var line: PackedScene

var callback: Callable

func _ready() -> void:
    direct_connect_button.pressed.connect(func() -> void: self.callback.call('direct_connect'))

func init(config: Dictionary, cb: Callable) -> void:
    super.init(config, callback)
    
    placeholder_label.text = config['default']
    self.callback = cb

var choices: Dictionary[Variant, ConnectionsPanelLine]
func add(config: Dictionary) -> void:
    var id: Variant = config['id']
    if choices.has(id):
        return update(config)
    
    var instance: ConnectionsPanelLine = line.instantiate()
    
    instance.id = config['id']
    #instance.icon_rect.texture = load()
    instance.name_label.text = config['name']
    instance.status_label.text = config['status']
    
    placeholder_label.visible = false
    
    choices.set(instance.id, instance)
    container.add_child(instance)

func update(config: Dictionary) -> void:
    var id: Variant = config['id']
    var instance: ConnectionsPanelLine = choices.get(id)
    instance.status_label.text = config['status']
    
func remove(config: Dictionary) -> void:
    var id: Variant = config['id']
    var instance: ConnectionsPanelLine = choices.get(id)
    container.remove_child(instance)
    instance.queue_free()
    choices.erase(id)
