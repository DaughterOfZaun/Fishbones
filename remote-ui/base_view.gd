class_name BaseView extends ShowableView

func bind_child(child: Control) -> void:
        
    if child is Button \
    && !(child is CheckBox) \
    && !(child is CheckButton) \
    && !(child is ColorPickerButton) \
    && !(child is MenuButton) \
    && !(child is OptionButton):
        assert((child as Button).pressed.connect(on_button_pressed.bind(child)) == OK)
        
    if child is LineEdit:
        assert((child as LineEdit).text_changed.connect(on_line_changed.bind(child)) == OK)
    
    if child is TextEdit:
        assert((child as TextEdit).text_changed.connect(on_text_changed.bind(child)) == OK)
        assert((child as TextEdit).text_set.connect(on_text_changed.bind(child)) == OK)

func on_button_pressed(child: Control) -> void:
    var path: String = child.get_meta('path')
    callback.call('call', path, 'pressed')
    
func on_line_changed(new_text: String, child: LineEdit) -> void:
    var path: String = child.get_meta('path')
    callback.call('call', path, 'changed', new_text)
    
func on_text_changed(child: TextEdit) -> void:
    var new_text := child.text
    var path: String = child.get_meta('path')
    callback.call('call', path, 'changed', new_text)

func strip_name_hashtag(child: Control) -> String:
    var key := child.name.substr(1)
    #key = key.substr(0, 1).to_lower() + child.name.substr(1)
    return key

func init_child(child_name: String, child: Control, cb: Callable) -> void:
    var child_path := path + '/' + child_name
    if child is ShowableView:
        (child as ShowableView).path = child_path
        (child as ShowableView).init({}, cb)
    else:
        child.set_meta('path', child_path)

func update_child(child: Control, config: Dictionary) -> void:
    if child is ShowableView:
        (child as ShowableView).update(config)
    elif child is OptionButton:
        pass #TODO:
    else:
        for key: String in config:
            child[key] = config[key]

func external_call(child_path: String, method_name: String, ...method_args: Array) -> void:
    var child_names := child_path.split('/')
    assert(child_names[0] == '.')
    child_names.remove_at(0)
    var current: Control = self
    for child_name in child_names:
        var children: Dictionary
        if 'fields' in current: children = current['fields']
        if 'items' in current: children = current['items']
        current = children[child_name]
    if current is ShowableView:
        assert(method_name in ['update', 'add_item', 'remove_item', 'update_item'])
        current.callv(method_name, method_args)
    else:
        assert(method_name == 'update')
        var config: Dictionary = method_args[0]
        update_child(current, config)
