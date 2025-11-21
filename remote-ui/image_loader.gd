class_name ImageLoader extends Node

var characters_dir_path := ".".path_join("Fishbones_Data").path_join("playable_client_126").path_join("DATA").path_join("Characters")

enum { DIR, FILE }

func fs_find(type: int, expr: String, max_count: int, path: String) -> PackedStringArray:
    var results := PackedStringArray([])
    var all_entry_names: PackedStringArray
    if type == DIR: all_entry_names = DirAccess.get_directories_at(path)
    if type == FILE: all_entry_names = DirAccess.get_files_at(path)
    for entry_name in all_entry_names:
        if entry_name.matchn(expr):
            var ok := results.append(entry_name); assert(ok == true)
            if max_count != 0 && results.size() >= max_count:
                break
    return results

func fs_find_single(type: int, expr: String, path: String) -> String:
    var results := fs_find(type, expr, 1, path)
    return results.get(0) if results.size() > 0 else ''

func load() -> void:
    var character_dir_names := DirAccess.get_directories_at(characters_dir_path)
    for character_dir_name in character_dir_names:
        var character_dir_path := characters_dir_path.path_join(character_dir_name)
        var info_dir_name := fs_find_single(DIR, "info", character_dir_path)
        var icon_file_name := fs_find_single(FILE, "*Square*.dds", info_dir_name)
        print(icon_file_name)
        # Unfinished

#TODO: Move to a separate class.
static var current_exe := OS.get_executable_path()
static var cwd := current_exe.get_base_dir()
static var downloads_dir_name := "Fishbones_Data"
static var downloads := cwd.path_join(downloads_dir_name)

static var null_ImageTexture := ImageTexture.new()
static var texture_cache: Dictionary[String, ImageTexture] = {}
static func get_texture(path: String) -> ImageTexture:
    var texture: ImageTexture = texture_cache.get(path, null_ImageTexture)
    if texture == null_ImageTexture:
        var image: Image

        if path.begins_with('res://'):
            var layer := 0
            var slices := path.split(':')
            if len(slices) > 2:
                path = slices[0] + ':' + slices[1]
                layer = slices[2].to_int()
            var unk_texture: Variant = load(path)
            if unk_texture is TextureLayered:
                image = (unk_texture as TextureLayered).get_layer_data(layer)
            elif unk_texture is Texture2D:
                image = (unk_texture as Texture2D).get_image()
        else:
            var long_path := downloads.path_join(path)
            #print('loading', ' ', long_path)
            var bytes := FileAccess.get_file_as_bytes(long_path)
            image = Image.new()
            var err := image.load_dds_from_buffer(bytes); assert(err == OK)

        texture = ImageTexture.create_from_image(image)
        texture_cache.set(path, texture)
    
    return texture
