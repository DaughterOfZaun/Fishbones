class_name ShowableView extends InputHandler

func init(_config: Dictionary, _callback: Callable) -> void:
    var current_node: Control = self
    while current_node != null:
        current_node.visible = true
        current_node = current_node.get_parent() as Control

func abort() -> void:
    self.visible = false
