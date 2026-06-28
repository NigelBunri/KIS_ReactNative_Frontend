import { API_BASE_URL } from '../config';

const mediaExtendedRoutes = {
  mediaExtended: {
    podcastChannels: API_BASE_URL + "/api/v1/media/extended/podcast-channels/",
    podcastChannel: (id: string) => API_BASE_URL + "/api/v1/media/extended/podcast-channels/" + id + "/",
    podcastEpisodes: API_BASE_URL + "/api/v1/media/extended/podcast-episodes/",
    podcastEpisode: (id: string) => API_BASE_URL + "/api/v1/media/extended/podcast-episodes/" + id + "/",
    musicTracks: API_BASE_URL + "/api/v1/media/extended/music-tracks/",
    musicTrackPlay: (id: string) => API_BASE_URL + "/api/v1/media/extended/music-tracks/" + id + "/play/",
    playlists: API_BASE_URL + "/api/v1/media/extended/playlists/",
    ebooks: API_BASE_URL + "/api/v1/media/extended/ebooks/",
    ebookPurchase: (id: string) => API_BASE_URL + "/api/v1/media/extended/ebooks/" + id + "/purchase/",
    ppvEvents: API_BASE_URL + "/api/v1/media/extended/ppv-events/",
    ppvPurchase: (id: string) => API_BASE_URL + "/api/v1/media/extended/ppv-events/" + id + "/purchase/",
    ppvStream: (id: string) => API_BASE_URL + "/api/v1/media/extended/ppv-events/" + id + "/stream/",
    news: API_BASE_URL + "/api/v1/media/extended/news/",
    creatorAnalytics: API_BASE_URL + "/api/v1/media/extended/creator/analytics/",
  },
};

export default mediaExtendedRoutes;
