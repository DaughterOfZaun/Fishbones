class_name ArrayView extends BaseView

var items: Dictionary[String, Control] = {}

@export var placeholder_container: Control
@export var placeholder_label: Label
@export var container: Control
@export var item_prefab: PackedScene
var first_item: Control

func _ready() -> void:

    if !placeholder_container:
        placeholder_container = placeholder_label
    if !container:
        container = self

    first_item = container.get_child(0)
    if first_item != null:
        
        #item_prefab = PackedScene.new()
        var children := first_item.find_children("*", "", true, false)
        for child: Node in children:
            child.owner = first_item
            child.remove_meta('registered')
        #var err := item_prefab.pack(first_item); assert(err == OK)
        
        container.remove_child(first_item)
        for i in range(container.get_child_count() -1, -1, -1):
            var child := container.get_child(i)
            container.remove_child(child)
            child.queue_free()

func update(config: Dictionary) -> void:
    
    var item_configs: Dictionary = config.get('items', {})
    
    for item_name: String in item_configs:
        var item_config: Dictionary = item_configs[item_name]
        if items.has(item_name): update_item(item_name, item_config)
        else: add_item(item_name, item_config)
    
    if placeholder_label && 'placeholderText' in config:
        placeholder_label.text = config['placeholderText']
    update_placeholder()

func set_items(item_configs: Dictionary) -> void:

    var allowed_names: Array[String] = []
    var disallowed_names: Array[String] = []

    for item_name: String in item_configs:
        var item_config: Dictionary = item_configs[item_name]
        if items.has(item_name): update_item(item_name, item_config)
        else: add_item(item_name, item_config)
        allowed_names.append(item_name)
    
    for item_name in items:
        if !allowed_names.has(item_name):
            disallowed_names.append(item_name)
            
    for item_name in disallowed_names:
        remove_item(item_name)

func add_item(item_name: String, item_config: Dictionary) -> void:
    var item: Control
    if item_prefab: item = item_prefab.instantiate()
    else: item = first_item.duplicate()
    
    var children := item.find_children("*", "", true, false)
    for child: Node in children:
        child.owner = item
    
    var result := items.set(item_name, item); assert(result == true)
    container.add_child(item)
    bind_child(item)
    init_child(item_name, item, callback)
    update_child(item, item_config)
    update_placeholder()

func update_item(item_name: String, item_config: Dictionary) -> void:
    var item: Control = items.get(item_name)
    update_child(item, item_config)

func remove_item(item_name: String) -> void:
    var item: Control = items.get(item_name)
    var result := items.erase(item_name); assert(result == true)
    container.remove_child(item)
    item.queue_free()
    update_placeholder()

func update_placeholder() -> void:
    if placeholder_container:
        placeholder_container.visible = len(items) == 0
