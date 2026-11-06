# Stage 1: Build aplikasi ASP.NET Core
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Katalog.Api.csproj", "./"]
RUN dotnet restore "Katalog.Api.csproj"
COPY . .
RUN dotnet publish "Katalog.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime Image yang ringan
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Render otomatis menyediakan port melalui environment variable PORT (default 8080)
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Katalog.Api.dll"]