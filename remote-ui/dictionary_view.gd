class_name DictionaryView extends BaseView

var fields: Dictionary[String, Control]

func _ready() -> void:

    var children_to_process: Array[Node] = get_children()
    children_to_process.reverse()
    while true:
        var nullable_child: Variant = children_to_process.pop_back()
        if nullable_child == null: break
        var child: Node = nullable_child

        if child.name.begins_with('#'):
            var key := child.name.substr(1)
            #key = key.substr(0, 1).to_lower() + child.name.substr(1)
            fields[key] = child

        if child is Control:
            bind_child(child as Control)

        if !(child is ArrayView || child is DictionaryView):
            var children := child.get_children(); children.reverse()
            children_to_process.append_array(children)

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
