class_name DictionaryView extends BaseView

@export var elements: Dictionary[String, Control]

func _ready() -> void:
    var children := find_children("#*")
    for child: Control in children:
        if child.get_meta('registered', false): continue
        child.set_meta('registered', true)
        
        var key := strip_name_hashtag(child)
        elements[key] = child
        
        bind_child(child, key)

func init(config: Dictionary, cb: Callable) -> void:
    super.init(config, cb)
    for key: String in elements:
        var value := elements[key]
        init_child(id, value, cb)

func update(config: Dictionary) -> void:
    for key: String in config:
        if key == 'id': continue
        var value: Variant = config[key]
        var control: Control = self.elements[key]
        update_child(control, value)        
