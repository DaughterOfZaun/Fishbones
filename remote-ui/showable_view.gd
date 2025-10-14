class_name ShowableView extends InputHandler

var path: String = '.'
var callback: Callable

func init(config: Dictionary, cb: Callable) -> void:
    (get_tree().current_scene as ServerNode).show_view(self)
    self.callback = cb
    self.update(config)
    
func update(_config) -> void: pass

func abort() -> void:
    (get_tree().current_scene as ServerNode).hide_view(self)
