class_name BaseView extends ShowableView

func bind_child(child: Control, key: String) -> void:
    
    var key_pressed := key + '.pressed'
    var key_changed := key + '.changed'
    
    if child is Button \
    && !(child is CheckBox) \
    && !(child is CheckButton) \
    && !(child is ColorPickerButton) \
    && !(child is MenuButton) \
    && !(child is OptionButton):
        (child as Button).pressed.connect(on_button_pressed.bind(key_pressed, child))
        
    if child is LineEdit:
        (child as LineEdit).text_changed.connect(on_line_changed.bind(key_changed, child))
    
    if child is TextEdit:
        (child as TextEdit).text_changed.connect(on_text_changed.bind(key_changed, child))
        (child as TextEdit).text_set.connect(on_text_changed.bind(key_changed, child))

func on_button_pressed(key: String, child: Control) -> void:
    var id: Variant = child.get_meta('id')
    if id != null: callback.call(key, id)
    else: callback.call(key)
    
func on_line_changed(new_text: String, key: String, child: LineEdit) -> void:
    var id: Variant = child.get_meta('id')
    if id != null: callback.call(key, id, new_text)
    else: callback.call(key, new_text)
    
func on_text_changed(key: String, child: TextEdit) -> void:
    var new_text := child.text
    var id: Variant = child.get_meta('id')
    if id != null: callback.call(key, id, new_text)
    else: callback.call(key, new_text)

func strip_name_hashtag(child: Control) -> String:
    var key := child.name.substr(1)
    #key = key.substr(0, 1).to_lower() + child.name.substr(1)
    return key

func init_child(id: Variant, child: Control, cb: Callable) -> void:
    if child is ShowableView:
        (child as ShowableView).id = id
        (child as ShowableView).init({}, cb)
    elif id != null:
        child.set_meta('id', id)

#var allowed_keys := [ 'visible', 'text', 'disabled', 'button_pressed' ]
func update_child(child: Control, config: Dictionary) -> void:
    if child is ShowableView:
        (child as ShowableView).update(config)
    elif child is OptionButton:
        pass #TODO:
    else:
        for key: String in config:
            if key == 'id': continue
            child[key] = config[key]        
