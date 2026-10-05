import { API_BASE_URL } from '../config';

const mediaExtendedRoutes = {
  mediaExtended: {
    podcastChannels: API_BASE_URL + "/api/v1/media/extended/podcasts/",
    podcastChannel: (id: string) => API_BASE_URL + "/api/v1/media/extended/podcasts/" + id + "/",
    podcastEpisodes: API_BASE_URL + "/api/v1/media/extended/podcast-episodes/",
    podcastEpisode: (id: string) => API_BASE_URL + "/api/v1/media/extended/podcast-episodes/" + id + "/",
    musicTracks: API_BASE_URL + "/api/v1/media/extended/music/",
    musicTrackPlay: (id: string) => API_BASE_URL + "/api/v1/media/extended/music/" + id + "/play/",
    playlists: API_BASE_URL + "/api/v1/media/extended/playlists/",
    ebooks: API_BASE_URL + "/api/v1/media/extended/ebooks/",
    ebookPurchase: (id: string) => API_BASE_URL + "/api/v1/media/extended/ebooks/" + id + "/purchase/",
    ppvEvents: API_BASE_URL + "/api/v1/media/extended/ppv/",
    ppvPurchase: (id: string) => API_BASE_URL + "/api/v1/media/extended/ppv/" + id + "/purchase/",
    ppvStream: (id: string) => API_BASE_URL + "/api/v1/media/extended/ppv/" + id + "/stream/",
    news: API_BASE_URL + "/api/v1/media/extended/news/",
    creatorAnalytics: API_BASE_URL + "/api/v1/media/extended/creator/analytics/",
  },
};

export default mediaExtendedRoutes;
