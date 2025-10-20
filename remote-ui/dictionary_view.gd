class_name DictionaryView extends BaseView

var fields: Dictionary[String, Control]

func _ready() -> void:
    var children := find_children("#*", "", true, false)
    for child: Control in children:
        if child.get_meta('registered', false): continue
        child.set_meta('registered', true)
        
        var field_name := strip_name_hashtag(child)
        fields[field_name] = child
        
        bind_child(child)

func init(config: Dictionary, cb: Callable) -> void:
    super.init(config, cb)
    for field_name: String in fields:
        var field := fields[field_name]
        init_child(field_name, field, cb)

func update(config: Dictionary, strict: bool = false) -> void:
    if len(config) == 0: return #HACK:
    
    var field_configs: Dictionary = config.get('fields', {})
    for field_name: String in field_configs:
        var field_config: Dictionary = field_configs[field_name]
        var field: Control = self.fields[field_name]
        update_child(field, field_config, strict)
