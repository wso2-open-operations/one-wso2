// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import type { CSSProperties } from "react";
import { Box } from "@wso2/oxygen-ui";
import type { SxProps, Theme } from "@wso2/oxygen-ui";
import {
  ArrowDown as LucideArrowDown,
  ArrowLeft as LucideArrowLeft,
  ArrowLeftRight as LucideArrowLeftRight,
  ArrowUp as LucideArrowUp,
  ArrowUpDown as LucideArrowUpDown,
  BadgeCheck as LucideBadgeCheck,
  Bell as LucideBell,
  BellRing as LucideBellRing,
  Bookmark as LucideBookmark,
  BookmarkPlus as LucideBookmarkPlus,
  Bot as LucideBot,
  Building2 as LucideBuilding2,
  CalendarDays as LucideCalendarDays,
  ChartNoAxesCombined as LucideChartNoAxesCombined,
  Check as LucideCheck,
  ChevronDown as LucideChevronDown,
  ChevronRight as LucideChevronRight,
  ChevronUp as LucideChevronUp,
  ChevronsUpDown as LucideChevronsUpDown,
  CircleAlert as LucideCircleAlert,
  CircleCheck as LucideCircleCheck,
  CircleMinus as LucideCircleMinus,
  CirclePause as LucideCirclePause,
  CirclePlay as LucideCirclePlay,
  CirclePlus as LucideCirclePlus,
  CircleStop as LucideCircleStop,
  Clock as LucideClock,
  CloudCog as LucideCloudCog,
  CloudUpload as LucideCloudUpload,
  Database as LucideDatabase,
  Download as LucideDownload,
  ExternalLink as LucideExternalLink,
  Eye as LucideEye,
  File as LucideFile,
  FileCode as LucideFileCode,
  FileUp as LucideFileUp,
  Fingerprint as LucideFingerprint,
  Flag as LucideFlag,
  Flame as LucideFlame,
  Github as LucideGithub,
  Globe as LucideGlobe,
  GraduationCap as LucideGraduationCap,
  History as LucideHistory,
  Info as LucideInfo,
  Link as LucideLink,
  Linkedin as LucideLinkedin,
  Lock as LucideLock,
  Mail as LucideMail,
  MapPin as LucideMapPin,
  Megaphone as LucideMegaphone,
  Merge as LucideMerge,
  MessageCircle as LucideMessageCircle,
  MessageSquarePlus as LucideMessageSquarePlus,
  Network as LucideNetwork,
  Paperclip as LucidePaperclip,
  Phone as LucidePhone,
  Play as LucidePlay,
  Plus as LucidePlus,
  RefreshCw as LucideRefreshCw,
  RotateCcw as LucideRotateCcw,
  RotateCw as LucideRotateCw,
  Search as LucideSearch,
  SearchCheck as LucideSearchCheck,
  Send as LucideSend,
  SlidersHorizontal as LucideSlidersHorizontal,
  Snowflake as LucideSnowflake,
  Sparkles as LucideSparkles,
  ThumbsDown as LucideThumbsDown,
  ThumbsUp as LucideThumbsUp,
  Trash as LucideTrash,
  Trash2 as LucideTrash2,
  TrendingUp as LucideTrendingUp,
  TriangleAlert as LucideTriangleAlert,
  User as LucideUser,
  UserPlus as LucideUserPlus,
  Users as LucideUsers,
  WandSparkles as LucideWandSparkles,
  Webhook as LucideWebhook,
  Wrench as LucideWrench,
  X as LucideX,
  Zap as LucideZap,
  type LucideIcon,
} from "@wso2/oxygen-ui-icons-react";

/** The sizes an icon can be asked for by name; anything else comes from `sx.fontSize`. */
const FONT_SIZE = { inherit: "inherit", small: "1.25rem", medium: "1.5rem", large: "2.1875rem" } as const;

/** Props every ISAC icon takes: sized by font size and coloured by palette name, like the text beside it. */
export interface IsacIconProps {
  fontSize?: keyof typeof FONT_SIZE;
  color?: "inherit" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
  sx?: SxProps<Theme>;
  className?: string;
  style?: CSSProperties;
}

/** An icon component that takes IsacIconProps. */
export type IsacIcon = (props: IsacIconProps) => React.JSX.Element;

/** Wraps an icon so it is sized in `em` from its font size and can be styled through `sx`. */
function sized(Icon: LucideIcon): IsacIcon {
  return function SizedIcon({ fontSize = "medium", color = "inherit", sx, ...rest }: IsacIconProps) {
    return (
      <Box
        component={Icon}
        aria-hidden
        sx={[
          {
            width: "1em",
            height: "1em",
            flexShrink: 0,
            fontSize: FONT_SIZE[fontSize],
            color: color === "inherit" ? "inherit" : `${color}.main`,
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...rest}
      />
    );
  };
}

export const AcUnit = sized(LucideSnowflake);
export const AccessTime = sized(LucideClock);
export const Add = sized(LucidePlus);
export const AddCircleOutline = sized(LucideCirclePlus);
export const AddCommentOutlined = sized(LucideMessageSquarePlus);
export const Api = sized(LucideWebhook);
export const ArrowBack = sized(LucideArrowLeft);
export const ArrowDownward = sized(LucideArrowDown);
export const ArrowUpward = sized(LucideArrowUp);
export const AttachFile = sized(LucidePaperclip);
export const AutoAwesome = sized(LucideSparkles);
export const AutoFixHigh = sized(LucideWandSparkles);
export const Autorenew = sized(LucideRefreshCw);
export const Bolt = sized(LucideZap);
export const Bookmark = sized(LucideBookmark);
export const BookmarkAdd = sized(LucideBookmarkPlus);
export const Build = sized(LucideWrench);
export const Business = sized(LucideBuilding2);
export const CalendarMonthOutlined = sized(LucideCalendarDays);
export const CallMerge = sized(LucideMerge);
export const Campaign = sized(LucideMegaphone);
export const ChatBubbleOutline = sized(LucideMessageCircle);
export const Check = sized(LucideCheck);
export const CheckCircle = sized(LucideCircleCheck);
export const CheckCircleOutline = sized(LucideCircleCheck);
export const ChevronRight = sized(LucideChevronRight);
export const Close = sized(LucideX);
export const CloudSync = sized(LucideCloudCog);
export const CloudUpload = sized(LucideCloudUpload);
export const DeleteForever = sized(LucideTrash2);
export const DeleteOutline = sized(LucideTrash);
export const Email = sized(LucideMail);
export const ErrorOutline = sized(LucideCircleAlert);
export const ExpandLess = sized(LucideChevronUp);
export const ExpandMore = sized(LucideChevronDown);
export const FileDownload = sized(LucideDownload);
export const FileDownloadOutlined = sized(LucideDownload);
export const Fingerprint = sized(LucideFingerprint);
export const FlagOutlined = sized(LucideFlag);
export const GitHub = sized(LucideGithub);
export const Group = sized(LucideUsers);
export const History = sized(LucideHistory);
export const Hub = sized(LucideNetwork);
export const HubOutlined = sized(LucideNetwork);
export const InfoOutlined = sized(LucideInfo);
export const InsertDriveFileOutlined = sized(LucideFile);
export const Insights = sized(LucideChartNoAxesCombined);
export const IntegrationInstructions = sized(LucideFileCode);
export const KeyboardArrowDown = sized(LucideChevronDown);
export const Launch = sized(LucideExternalLink);
export const Link = sized(LucideLink);
export const LinkedIn = sized(LucideLinkedin);
export const LocalFireDepartment = sized(LucideFlame);
export const LockOutlined = sized(LucideLock);
export const MailOutline = sized(LucideMail);
export const NotificationsActive = sized(LucideBellRing);
export const NotificationsNone = sized(LucideBell);
export const OpenInNew = sized(LucideExternalLink);
export const PauseCircleOutline = sized(LucideCirclePause);
export const People = sized(LucideUsers);
export const PeopleOutline = sized(LucideUsers);
export const PersonAddAltOutlined = sized(LucideUserPlus);
export const PersonOutline = sized(LucideUser);
export const Phone = sized(LucidePhone);
export const PlaceOutlined = sized(LucideMapPin);
export const PlayArrow = sized(LucidePlay);
export const PlayCircleOutline = sized(LucideCirclePlay);
export const Public = sized(LucideGlobe);
export const Refresh = sized(LucideRotateCw);
export const RemoveCircleOutline = sized(LucideCircleMinus);
export const Replay = sized(LucideRotateCcw);
export const RestartAlt = sized(LucideRotateCcw);
export const Schedule = sized(LucideClock);
export const School = sized(LucideGraduationCap);
export const Search = sized(LucideSearch);
export const Send = sized(LucideSend);
export const SmartToy = sized(LucideBot);
export const Sort = sized(LucideArrowUpDown);
export const StopCircle = sized(LucideCircleStop);
export const Storage = sized(LucideDatabase);
export const StorageOutlined = sized(LucideDatabase);
export const SwapHoriz = sized(LucideArrowLeftRight);
export const Sync = sized(LucideRefreshCw);
export const ThumbDownAltOutlined = sized(LucideThumbsDown);
export const ThumbUpAltOutlined = sized(LucideThumbsUp);
export const TrendingUp = sized(LucideTrendingUp);
export const TroubleshootOutlined = sized(LucideSearchCheck);
export const Tune = sized(LucideSlidersHorizontal);
export const UnfoldMore = sized(LucideChevronsUpDown);
export const UploadFile = sized(LucideFileUp);
export const Verified = sized(LucideBadgeCheck);
export const VisibilityOutlined = sized(LucideEye);
export const WarningAmber = sized(LucideTriangleAlert);
export const Whatshot = sized(LucideFlame);
