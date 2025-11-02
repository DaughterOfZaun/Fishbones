class_name CustomPopup extends Window

@export var close: Button
@export var timer: Timer
@export var header: Label
@export var body: Label
@export var player: AudioStreamPlayer
@export var sounds: Dictionary[String, AudioStream]

func pop(title: String, message: String, sound: String) -> void:
    var ur := DisplayServer.screen_get_usable_rect()
    position = ur.position + ur.size - self.size - Vector2i(4, 4)
    player.stream = sounds[sound]
    header.text = title
    body.text = message
    player.play()
    timer.start()
    show()

func _ready() -> void:
    timer.timeout.connect(hide)
    close.pressed.connect(hide)
