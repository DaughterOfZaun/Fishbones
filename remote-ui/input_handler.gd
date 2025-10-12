class_name InputHandler extends Control

func init(_config: Dictionary, _cb: Callable) -> void: pass

func abort() -> void:
    queue_free()

func update_select(container: Control, button: PackedScene, choices: Array, init_seq: Callable, update_seq: Callable) -> void:
    
    #for i in range(max(0, container.get_child_count() - len(choices))):
    for i in range(container.get_child_count() - 1, -1, -1):
        var instance: Control = container.get_child(i)
        container.remove_child(instance)
        instance.queue_free()

    #for i in range(max(0, len(choices) - container.get_child_count())):
    for i in range(len(choices)):
        var instance: Control = button.instantiate()
        container.add_child(instance)
        init_seq.call(instance)

    for i in range(len(choices)):
        var choice: Dictionary = choices[i]
        var instance: Control = container.get_child(i)
        update_seq.call(instance, choice)
