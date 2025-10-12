class_name ArrayView extends BaseView

@export var default_key: String
@export var placeholder_container: Control
@export var placeholder_label: Label
@export var container: Control
@export var line: PackedScene

var instances: Dictionary[Variant, Control] = {}

func _ready() -> void:
    if !placeholder_container:
        placeholder_container = placeholder_label
    if !container:
        container = self
    if !line:
        line = PackedScene.new()
        line.pack(container.get_child(0))
    for i in range(container.get_child_count() -1, 0, -1):
        var child := container.get_child(i)
        container.remove_child(child)

func update(config: Dictionary) -> void:
    
    var allowed_ids := []
    var disallowed_ids := []
    
    var choices: Array = config.get('choices', [])
    for i in range(len(choices)):
        var choice: Dictionary = choices[i]
        var id: Variant = config.get('id', i)
        allowed_ids.append(id)
        add_by_id(id, choice)
        #config.set('id', id)
        #add(choice)
    
    for id in instances:
        if !allowed_ids.has(id):
            disallowed_ids.append(id)
            
    for id: Variant in disallowed_ids:
        instances.erase(id)
    
    if placeholder_label && 'default' in config:
        placeholder_label.text = config['default']
    update_placeholder()

func add(config: Dictionary) -> void:
    var id: Variant = config['id']
    add_by_id(id, config)
    update_placeholder()

func add_by_id(id: Variant, config: Dictionary) -> void:
    if instances.has(id):
        return update_single_by_id(id, config)
        
    var instance: Control = line.instantiate()
    instances.set(id, instance)
    container.add_child(instance)
    bind_child(instance, default_key)
    init_child(id, instance, callback)

func update_single(config: Dictionary) -> void:
    var id: Variant = config['id']
    update_single_by_id(id, config)

func update_single_by_id(id: Variant, config: Dictionary) -> void:
    var instance: Control = instances.get(id)
    update_child(instance, config)
    
func remove(config: Dictionary) -> void:
    var id: Variant = config['id']
    remove_by_id(id)
    update_placeholder()
    
func remove_by_id(id: Variant) -> void:
    var instance: Control = instances.get(id)
    container.remove_child(instance)
    instance.queue_free()
    instances.erase(id)

func update_placeholder() -> void:
    if placeholder_container:
        placeholder_container.visible = len(instances) == 0
