class_name ShowableView extends InputHandler

var id: Variant
var callback: Callable

func init(config: Dictionary, cb: Callable) -> void:
    (get_tree().current_scene as ServerNode).show_view(self)

    #super.init(config, callback)     
    self.update(config)
    self.callback = cb
    
func update(_config) -> void:
    pass

func abort() -> void:
    (get_tree().current_scene as ServerNode).hide_view(self)
