class_name ImageLoader extends Node

#TODO: Move to a separate class.
static var current_exe := OS.get_executable_path()
static var cwd := current_exe.get_base_dir()
static var downloads_dir_name := "Fishbones_Data"
static var downloads := cwd.path_join(downloads_dir_name)

static var client_dir_name := 'playable_client_126'
static var client_sln_version := '0.0.0.51'
static var client_absolute_path := \
    'C:/Riot Games/League of Legends/RADS/solutions/lol_game_client_sln/releases/' + client_sln_version if OS.get_name() == "Windows" \
    else downloads.path_join(client_dir_name)
static var client_data_absolute_path := client_absolute_path.path_join('DATA')

static var null_ImageTexture := ImageTexture.new()
static var texture_cache: Dictionary[String, ImageTexture] = {}
static func get_texture(path: String) -> ImageTexture:
    var texture: ImageTexture = texture_cache.get(path, null_ImageTexture)
    if texture == null_ImageTexture:
        var image: Image

        if path.begins_with('res://'):
            var layer := 0
            var path_to_load := path
            var slices := path.split(':')
            if len(slices) > 2:
                path_to_load = slices[0] + ':' + slices[1]
                layer = slices[2].to_int()
            var unk_texture: Variant = load(path_to_load)
            if unk_texture is TextureLayered:
                image = (unk_texture as TextureLayered).get_layer_data(layer)
            elif unk_texture is Texture2D:
                image = (unk_texture as Texture2D).get_image()
        else:
            var path_to_load: String
            if path.begins_with('%DATA%'):
                path_to_load = path.replace('%DATA%', client_data_absolute_path)
            else:
                path_to_load = downloads.path_join(path)
            
            var bytes := FileAccess.get_file_as_bytes(path_to_load)
            image = Image.new()
            var err := image.load_dds_from_buffer(bytes); assert(err == OK)

        texture = ImageTexture.create_from_image(image)
        var result := texture_cache.set(path, texture); assert(result == true)
    
    return texture
