export type ChampdsAttachment = {
    CustomerMediaID: number;
    MediaFileName: string;
    MediaFileLocation: string;
    MediaNickName: string;
    SizeBytes: number;
};

export type ChampdsAgendaItem = {
    CustomerAgendaItemID: number;
    Title: string;
    Description: string;
    OrderOrdinal: number;
    OrderParentID: number;
    LastModifyDateTimeUTC?: string | null;
    Attachments?: ChampdsAttachment[];
    Children?: ChampdsAgendaItem[];
};

export type ChampdsEvent = {
    Event: {
        CustomerEventID: number;
        EventTitle: string;
        EventDescription: string;
        EventDateTimeUTC: string;
        EventDateTimeCustomerLocal?: string;
        LastModifyDateTimeUTC?: string | null;
        EventPublishStatusID?: number;
    };
    Agenda: { AgendaItems: ChampdsAgendaItem[]; Attachments?: ChampdsAttachment[] };
    Minutes?: { Attachments?: ChampdsAttachment[] };
    MediaInfo?: { MediaPath?: string | null } | null;
};

export type ChampdsListEvent = {
    CustomerEventID: number;
    EventTitle: string;
    EventDescription: string;
    EventDateTimeUTC: string;
    LastModifyDateTimeUTC?: string | null;
    MediaInfo?: { MediaPath?: string | null } | null;
};
