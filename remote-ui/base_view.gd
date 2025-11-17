class_name BaseView extends ShowableView

func bind_child(child: Control) -> void:
    
    if (child is CheckBox || child is CheckButton):
        var err := (child as Button).toggled.connect(on_button_toggled.bind(child)); assert(err == OK)
    elif child is OptionButton:
        var err := (child as OptionButton).item_selected.connect(on_item_selected.bind(child)); assert(err == OK)
    elif child is Button \
    && !(child is ColorPickerButton) \
    && !(child is MenuButton):
        var err := (child as Button).pressed.connect(on_button_pressed.bind(child)); assert(err == OK)
    
    if child is LineEdit:
        var err := (child as LineEdit).text_changed.connect(on_line_changed.bind(child)); assert(err == OK)
    
    if child is TextEdit:
        var err := (child as TextEdit).text_changed.connect(on_text_changed.bind(child)); assert(err == OK)
        err = (child as TextEdit).text_set.connect(on_text_changed.bind(child)); assert(err == OK)

func on_button_pressed(child: Control) -> void:
    var path: String = child.get_meta('path')
    callback.call('call', path, 'pressed')
    
func on_button_toggled(on: bool, child: Control) -> void:
    var path: String = child.get_meta('path')
    callback.call('call', path, 'toggled', on)

func on_item_selected(index: int, child: OptionButton) -> void:
    var id := child.get_item_id(index)
    var path: String = child.get_meta('path')
    callback.call('call', path, 'selected', id)

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

func update_child(child: Control, config: Dictionary, strict: bool = false) -> void:
    if child is ShowableView:
        (child as ShowableView).update(config, strict)
    elif child is OptionButton:
        (child as OptionButton).clear()
        if 'options' in config:
            for item: Dictionary in config['options']:
                var text: String = item['text']
                var item_id: int = item['id']
                (child as OptionButton).add_item(text, item_id)
        if 'selected' in config:
            var selected_id: int = config['selected']
            var index: int = (child as OptionButton).get_item_index(selected_id)
            (child as OptionButton).select(index)
        if 'disabled' in config:
            (child as OptionButton).disabled = config['disabled']
    else:
        for key: String in config:
            if (child is Button && key == 'icon')\
            || (child is TextureRect && key == 'texture'):
                var path: String = config[key]
                child[key] = ImageLoader.get_texture(path) if !path.is_empty() else null
            else:
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
        assert(method_name in ['update', 'add_item', 'remove_item', 'set_items'])
        current.callv(method_name, method_args)
    else:
        assert(method_name == 'update')
        var config: Dictionary = method_args[0]
        update_child(current, config, false)
