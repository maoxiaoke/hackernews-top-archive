/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { kv } from "@vercel/kv";
import { format, localeFormat } from "light-date";
import { ChevronLeftCircle, ChevronRightCircle, History } from "lucide-react";
import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth/next";
import { useMemo, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { DatePicker } from "@/components/date-picker";
import { Toaster } from "@/components/ui/sonner";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/utils/cn";
import { copyToClipboard } from "@/utils/copyToClipborad";
import type { ViewType } from "@/utils/date";
import {
  getEndOfDateTimeByUnit,
  getSecondFromTimeStamp,
  getStartDateTimeByUnit,
  getTimeWalkingDateByUnit,
} from "@/utils/date";

import { toast } from "sonner";

import { authOptions } from "./api/auth/[...nextauth]";

export type HitTag =
  | "story"
  | "show_hn"
  | "ask_hn"
  | "job"
  | "poll"
  | "front_page";

export interface Hit {
  author: "string";
  children?: string[];
  created_at: string;
  created_at_i: number;
  num_comments: number;
  objectID: string;
  points: number;
  story_id: string;
  title: string;
  updated_at: string;
  url: string;

  _tags: HitTag;
  _highlightResult?: any;
}

let datePickerInstance: any = null;
const currentDate = new Date();
const last24CachedTime = 60 * 10;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const isContainTag = (hit: Hit, tag: HitTag) => {
  return (hit?._tags ?? []).includes(tag);
};

const pickNecessaryHitParm = (hit: Hit) => {
  const _hit = {
    ...hit,
  };
  delete _hit.children;
  delete _hit._highlightResult;
  return _hit;
};

const getStartAndEndTimetamp = (viewType: ViewType, selectDate: Date) => {
  if (viewType === "last24" || viewType === "custom") {
    return {
      start: getSecondFromTimeStamp(selectDate) - 24 * 60 * 60,
      end: getSecondFromTimeStamp(selectDate),
    };
  }

  return {
    start: getSecondFromTimeStamp(getStartDateTimeByUnit(selectDate, viewType)),
    end: getSecondFromTimeStamp(getEndOfDateTimeByUnit(selectDate, viewType)),
  };
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);

  console.log("sesion11111", session, context);

  const currentTimeStamp = Date.now();

  const endTimeStampBySecond = getSecondFromTimeStamp(currentTimeStamp);
  const startTimeStampBySecond =
    getSecondFromTimeStamp(currentTimeStamp) - 24 * 60 * 60;

  const cacheEndTimeStampBySecond =
    (await kv.hget<number>("last24Cache:page:0", "endTime")) ??
    endTimeStampBySecond;

  // If the cache is not within  10 min, it will be updated
  if (endTimeStampBySecond - cacheEndTimeStampBySecond > last24CachedTime) {
    const querys = `?query=&numericFilters=created_at_i>${startTimeStampBySecond},created_at_i<${endTimeStampBySecond}&advancedSyntax=true&hitsPerPage=15`;

    // https://hn.algolia.com/api
    // https://www.algolia.com/doc/api-reference/search-api-parameters/
    const revRes = await fetch(
      `${process.env.HACKER_NEWS_SEARCH_URL}${querys}`,
      {
        method: "GET",
      }
    );

    const resObj = await revRes.json();

    if (resObj?.hits) {
      kv.hset("last24Cache:page:0", {
        endTime: endTimeStampBySecond,
        startTime: startTimeStampBySecond,
        page: 0,
        hits: JSON.stringify((resObj.hits ?? []).map(pickNecessaryHitParm)),
      });
    }

    return {
      props: {
        hits: resObj?.hits ?? [],
        userSession: session ?? null,
        last24StartTime: startTimeStampBySecond,
        last24EndTime: endTimeStampBySecond,
      },
    };
  }

  const hits = await kv.hget<string>("last24Cache:page:0", "hits");

  return {
    props: {
      hits: hits ?? [],
      userSession: session ?? null,
      last24StartTime: cacheEndTimeStampBySecond - 24 * 60 * 60,
      last24EndTime: cacheEndTimeStampBySecond,
    },
  };
}

export interface HackNewsTopArchiveProps {
  hits: Hit[];
  userSession: Session;
  last24StartTime: number;
  last24EndTime: number;
}

const HackNewsTopArchive = ({
  hits,
  userSession,
  last24EndTime,
  last24StartTime,
}: HackNewsTopArchiveProps) => {
  const datepickerEl = useRef<HTMLDivElement>(null);
  const { query, pathname } = useRouter();
  const isConcreteTime = query?.startTimeStamp && query?.endTimeStamp;

  const [viewType, setViewType] = useState<ViewType>(
    isConcreteTime ? "custom" : "last24"
  );
  const [selectedDate, setSelectedDate] = useState<Date>(currentDate);

  const isDay = viewType === "day" || viewType === "last24";

  /**
   * searchs params
   */
  const { start, end } = useMemo(() => {
    if (viewType === "custom" && isConcreteTime) {
      return {
        start: Number(query.startTimeStamp),
        end: Number(query.endTimeStamp),
      };
    }
    return getStartAndEndTimetamp(viewType, selectedDate);
  }, [viewType, selectedDate, query, isConcreteTime]);

  /**
   * request
   */
  const { data, isLoading, size, setSize } = useSWRInfinite(
    (index) => {
      return `/api/search?page=${index}&startTimeStamp=${start}&endTimeStamp=${end}&viewType=${viewType}`;
    },
    fetcher,
    {
      revalidateOnMount: true,
      revalidateFirstPage: false,
      fallbackData:
        viewType === "last24"
          ? [
              {
                hits: hits,
              },
            ]
          : [],
    }
  );

  const dayMonthYear = [
    isDay && format(selectedDate, "{dd}"),
    viewType !== "year" && localeFormat(selectedDate, "{MMMM}"),
    format(selectedDate, "{yyyy}"),
  ].filter(Boolean);

  const shareCurrentPage = async () => {
    let sharedUrl = "https://www.nazha.co/hackernews-top-archive";
    if (viewType === "last24") {
      sharedUrl = `https://www.nazha.co/hackernews-top-archive?viewType=last24&startTimeStamp=${last24StartTime}&endTimeStamp=${last24EndTime}`;
    }

    try {
      await copyToClipboard(sharedUrl);

      toast.success("Copied to clipboard");
    } catch {}
  };

  const allHits =
    data?.reduce((acc, cur) => {
      return [...acc, ...cur.hits];
    }, []) ?? [];

  const isLoadingMore =
    isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");

  const canTriggleRight = useMemo(() => {
    if (viewType === "last24" || viewType === "custom") {
      return false;
    }
    const { start: _start } = getStartAndEndTimetamp(viewType, currentDate);
    return _start > start;
  }, [viewType, start]);

  const canTrigglLeft = useMemo(() => {
    return viewType !== "last24";
  }, [viewType]);

  const timewalking = (backOrForward: -1 | 1) => {
    if (viewType === "last24" || viewType === "custom") {
      return;
    }

    const _date = getTimeWalkingDateByUnit(selectedDate, viewType, {
      backOrForward,
    });

    setSelectedDate(_date);
  };

  return (
    <>
      <Head>
        <link rel="icon" href="/images/hacker-news.png" sizes="any" />
      </Head>
      <div
        className="h-screen font-sourceSerif4"
        onClick={() => {
          if (datePickerInstance) {
            // @ts-ignore
            datePickerInstance.destroy();
            datePickerInstance = null;
          }
        }}
      >
        <nav className="bg-white border-gray-200 dark:bg-gray-900">
          <div className="flex flex-wrap justify-between items-center mx-auto max-w-screen-xl p-4">
            <Link href="/hackernews-top-archive" className="flex items-center">
              <Image
                className="w-8 h-8 overflow-hidden mr-3"
                src="/images/hacker-news.png"
                alt="Hacker News Cute Logo"
                width="32"
                height="32"
              />
              <span className="self-center text-xl font-semibold whitespace-nowrap dark:text-white font-catamaran">
                Top Archive
              </span>
            </Link>
            <div className="flex items-center">
              <Link
                href="https://twitter.com/xiaokedada"
                className="text-sm text-blue-600 dark:text-blue-500 hover:underline"
              >
                About me
              </Link>
              <span className="whitespace-break-spaces">{" · "}</span>
              <span
                className="text-sm text-hacker dark:text-blue-500 cursor-pointer"
                onClick={shareCurrentPage}
              >
                Share Current Page
              </span>
              <span className="whitespace-break-spaces">{" · "}</span>
              {userSession ? (
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={userSession?.user?.image ?? ""}
                    alt={userSession.user?.name ?? ""}
                  />
                  <AvatarFallback>{userSession.user?.name}</AvatarFallback>
                </Avatar>
              ) : (
                <div className="text-sm text-blue-600 dark:text-blue-500 hover:underline">
                  <SignedOut>
                    <SignInButton />
                  </SignedOut>
                  <SignedIn>
                    <UserButton />
                  </SignedIn>
                </div>
              )}
            </div>
          </div>
        </nav>

        <section className="w-full relative flex flex-row">
          <div className="flex-1 group">
            {canTrigglLeft ? (
              <ChevronLeftCircle
                onClick={() => timewalking(-1)}
                size={48}
                color="#ff6600"
                absoluteStrokeWidth
                className="fixed inset-y-1/2 left-60 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />
            ) : null}
          </div>

          <div className="w-[640px]">
            <header className="flex-wrap flex justify-between border-solid border-b py-4 px-6">
              {viewType !== "custom" ? (
                <ul>
                  {dayMonthYear.map((time, index) => {
                    return (
                      <li
                        key={index}
                        className={cn(
                          "inline-block mr-2 text-gray-700 font-catamaran",
                          index === 0 && "text-3xl text-gray-600",
                          index === 1 && "text-2xl text-gray-400",
                          index === 2 && "text-3xl text-gray-600"
                        )}
                      >
                        {time}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <span className="font-catamaran text-2xl flex items-center text-hacker">
                  {new Date(
                    Number(query.startTimeStamp + "000")
                  ).toLocaleDateString()}{" "}
                  ~{" "}
                  <span>
                    {new Date(
                      Number(query.endTimeStamp + "000")
                    ).toLocaleDateString()}
                  </span>
                </span>
              )}

              <div className="flex items-center justify-end">
                <Tabs
                  value={viewType}
                  onValueChange={(type: string) => {
                    setViewType(type as ViewType);
                    setSelectedDate(currentDate);
                    history.replaceState(null, "", pathname);
                  }}
                  className="rounded overflow-hidden"
                >
                  <TabsList>
                    <TabsTrigger value="last24">Last 24h</TabsTrigger>
                    <TabsTrigger value="day">Day</TabsTrigger>
                    <TabsTrigger value="month">Month</TabsTrigger>
                    <TabsTrigger value="year">Year</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="relative ml-4">
                  <DatePicker
                    onChange={(date: Date) => {
                      setSelectedDate(date);
                      setViewType("day");
                    }}
                  />

                  <div
                    ref={datepickerEl}
                    data-date={format(selectedDate, "{MM}/{dd}/{yyyy}")}
                    className="absolute top-8 left-0 z-10"
                    onClick={(evt) => {
                      evt.stopPropagation();
                    }}
                  ></div>
                </div>
              </div>
            </header>

            <ul className="mt-6 px-3 lg:px-0">
              {(allHits ?? []).map((hit: any, idx: number) => (
                <li
                  id={hit.story_id}
                  key={hit.story_id ?? hit.objectID ?? idx}
                  className="flex mb-[10px] text-sm"
                >
                  <HitItem hit={hit} number={idx + 1} />
                </li>
              ))}
            </ul>

            <div className="flex justify-center my-10">
              <button
                onClick={() => setSize(size + 1)}
                disabled={isLoadingMore}
                type="button"
                className="text-white bg-hacker hover:bg-hacker/80 focus:ring-4 focus:outline-none focus:ring-[#FF9119]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:hover:bg-[#FF9119]/80 dark:focus:ring-[#FF9119]/40 mr-2 mb-2"
              >
                {isLoadingMore ? (
                  <svg
                    aria-hidden="true"
                    role="status"
                    className="inline w-4 h-4 mr-3 text-white animate-spin"
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                      fill="#E5E7EB"
                    />
                    <path
                      d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : null}
                {isLoadingMore ? "Loading..." : "More"}
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center group">
            {canTriggleRight ? (
              <ChevronRightCircle
                onClick={() => timewalking(1)}
                size={48}
                color="#ff6600"
                absoluteStrokeWidth
                className="fixed inset-y-1/2 right-60 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
};

const HitItem = ({ hit, number }: { hit: Hit; number: number }) => {
  const isAnotherTag =
    isContainTag(hit, "ask_hn") || isContainTag(hit, "show_hn");

  return (
    <>
      <span className="inline-block opacity-50 w-8 text-right shrink-0">
        {number}.
      </span>
      <div className="ml-4 font-normal hover:text-hacker">
        {isAnotherTag ? (
          <span className="bg-red-700 inline-block leading-normal text-orange-100 rounded-sm text-sm sm:text-xs h-5 sm:h-4 mr-1 px-1">
            {hit.title.split(":")[0]}
          </span>
        ) : null}

        <Link
          href={
            hit.url ??
            `https://news.ycombinator.com/item?id=${
              hit.story_id ?? hit.objectID
            }`
          }
          className="hover:underline font-semibold opacity-90"
          target="_blank"
        >
          {isAnotherTag
            ? hit.title.split(":").slice(1).join(":") ?? hit.title
            : hit.title}
        </Link>

        <div className="text-xs font-normal text-black mt-[2px]">
          {hit.url ? (
            <>
              <Link href={hit.url} className="hover:underline text-blue-700">
                {new URL(hit.url).host}
              </Link>
              <span> · </span>
            </>
          ) : null}
          <span className="opacity-80">{hit.points} points</span> ·{" "}
          <Link
            href={`https://news.ycombinator.com/item?id=${
              hit.story_id ?? hit.objectID
            }`}
            className="hover:underline"
            target="_blank"
          >
            <span className="opacity-60">{hit.num_comments} comments</span>
          </Link>
        </div>
      </div>
    </>
  );
};

export default HackNewsTopArchive;
