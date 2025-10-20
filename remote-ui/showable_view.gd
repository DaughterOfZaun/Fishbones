class_name ShowableView extends InputHandler

var path: String = '.'
var callback: Callable
var is_top_level: bool

func init(_config: Dictionary, cb: Callable) -> void:
    (get_tree().current_scene as ServerNode).show_view(self)
    self.callback = cb
    #self.update(config)

func update(_config, _strict: bool = false) -> void: pass

func abort() -> void:
    (get_tree().current_scene as ServerNode).hide_view(self)
